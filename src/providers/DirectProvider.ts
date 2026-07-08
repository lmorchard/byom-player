import type { Track } from '../types';
import type { AudioProvider, ProviderState } from './types';

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
}

const API_VERSION = '1.16.1';
const CLIENT_NAME = 'byom-player';

// DirectProvider resolves a Track against a Navidrome/Subsonic server and plays
// the resulting stream via an HTML5 Audio element.
export class DirectProvider implements AudioProvider {
  name = 'direct';

  private readonly audio = new Audio();
  private readonly cfg: DirectConfig;
  private callback: (state: ProviderState) => void = () => {};

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as DirectConfig;
    this.audio.addEventListener('playing', () => this.callback('playing'));
    this.audio.addEventListener('pause', () => this.callback('paused'));
    this.audio.addEventListener('ended', () => this.callback('ended'));
    this.audio.addEventListener('error', () => this.callback('error'));
  }

  async initialize(): Promise<void> {
    this.callback('ready');
  }

  async load(track: Track): Promise<void> {
    const id = await this.resolve(track);
    if (!id) {
      this.callback('error');
      return;
    }
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

  // resolve queries Subsonic search3 for the best matching song id, or null.
  async resolve(track: Track): Promise<string | null> {
    const query = `${track.artist} ${track.title}`.trim();
    const res = await fetch(this.url('search3.view', { query, songCount: '1' }));
    const data = await res.json();
    const song = data?.['subsonic-response']?.searchResult3?.song?.[0];
    return song?.id ?? null;
  }

  streamUrl(id: string): string {
    return this.url('stream.view', { id });
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
