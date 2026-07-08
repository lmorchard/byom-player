import type { Track } from '../types';
import type { AudioProvider, AvailabilityStatus, ProviderState } from './types';

// Configuration for a Navidrome / Subsonic server. Supply exactly one auth mode:
//   - apiKey (newest Navidrome), or
//   - token + salt (classic Subsonic: token = md5(password + salt)), or
//   - username + password (legacy; plaintext over HTTPS).
export interface DirectConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  token?: string;
  salt?: string;
  apiKey?: string;
  // Transient-failure tolerance for resolution requests.
  retries?: number; // extra attempts after the first (default 2)
  retryDelayMs?: number; // base backoff, multiplied by attempt number (default 400)
  debug?: boolean; // console.debug resolution outcomes
}

const API_VERSION = '1.16.1';
const CLIENT_NAME = 'byom-player';

// DirectProvider resolves a Track against a Navidrome/Subsonic server and plays
// the resulting stream via an HTML5 Audio element.
export class DirectProvider implements AudioProvider {
  name = 'direct';

  private readonly audio = new Audio();
  private readonly cfg: DirectConfig;
  private readonly listeners = new AbortController();
  private callback: (state: ProviderState) => void = () => {};

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as DirectConfig;
    const opts = { signal: this.listeners.signal };
    this.audio.addEventListener('playing', () => this.callback('playing'), opts);
    this.audio.addEventListener('pause', () => this.callback('paused'), opts);
    this.audio.addEventListener('ended', () => this.callback('ended'), opts);
    this.audio.addEventListener('error', () => this.callback('error'), opts);
  }

  async initialize(): Promise<void> {
    this.callback('ready');
  }

  async load(track: Track): Promise<void> {
    let id: string | null;
    try {
      id = await this.resolve(track);
    } catch (err) {
      // Transient failure that persisted past retries — NOT a clean miss.
      this.log('resolve error', track.artist, '-', track.title, err);
      this.callback('error');
      return;
    }
    if (!id) {
      // Server answered but the track isn't in the collection — a clean miss.
      this.log('not in collection', track.artist, '-', track.title);
      this.callback('unavailable');
      return;
    }
    this.log('resolved', track.artist, '-', track.title, '->', id);
    this.audio.src = this.streamUrl(id);
    this.callback('ready');
  }

  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch {
      this.callback('error');
    }
  }

  pause(): void {
    this.audio.pause();
  }

  seek(positionMs: number): void {
    this.audio.currentTime = positionMs / 1000;
  }

  onStateChange(callback: (state: ProviderState) => void): void {
    this.callback = callback;
  }

  dispose(): void {
    this.listeners.abort();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  // resolve queries Subsonic search3 for the best matching song id, or null when
  // the server responds successfully but the track isn't in the collection.
  // Transient failures (network/5xx/subsonic-failed) are retried, then thrown.
  async resolve(track: Track): Promise<string | null> {
    const query = `${track.artist} ${track.title}`.trim();
    const data = await this.fetchJson(this.url('search3.view', { query, songCount: '1' }));
    const song = data?.['subsonic-response']?.searchResult3?.song?.[0];
    return song?.id ?? null;
  }

  private log(...args: unknown[]): void {
    if (this.cfg.debug) console.debug('[byom-player:direct]', ...args);
  }

  private async fetchJson(url: string): Promise<any> {
    const retries = this.cfg.retries ?? 2;
    const baseDelay = this.cfg.retryDelayMs ?? 400;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data?.['subsonic-response']?.status === 'failed') {
          throw new Error('subsonic-response status failed');
        }
        return data;
      } catch (err) {
        if (attempt >= retries) throw err;
        await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
      }
    }
  }

  streamUrl(id: string): string {
    return this.url('stream.view', { id });
  }

  async checkAvailability(track: Track): Promise<AvailabilityStatus> {
    try {
      const id = await this.resolve(track);
      return id ? 'available' : 'unavailable';
    } catch {
      return 'unknown'; // transient failure — don't mark the track missing
    }
  }

  private authParams(): URLSearchParams {
    const params = new URLSearchParams({ v: API_VERSION, c: CLIENT_NAME, f: 'json' });
    const { apiKey, username, token, salt, password } = this.cfg;
    if (apiKey) {
      params.set('apiKey', apiKey);
    } else if (token && salt) {
      if (username) params.set('u', username);
      params.set('t', token);
      params.set('s', salt);
    } else if (username && password) {
      params.set('u', username);
      params.set('p', password);
    }
    return params;
  }

  private url(view: string, extra: Record<string, string>): string {
    const params = this.authParams();
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    const base = this.cfg.baseUrl.replace(/\/$/, '');
    return `${base}/rest/${view}?${params.toString()}`;
  }
}
