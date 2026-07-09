import type { Track } from '../types';
import type { AudioProvider, AvailabilityStatus, ProviderState } from './types';
import { md5 } from '../md5';
import { trackKey, LocalStorageResolutionCache, type ResolutionCache } from './resolutionCache';

// Configuration for a Subsonic / OpenSubsonic server (Navidrome, gonic, Airsonic,
// LMS, …). Uses only core Subsonic endpoints, so it's not Navidrome-specific.
// Supply exactly one auth mode:
//   - apiKey (OpenSubsonic extension; not all servers support it), or
//   - token + salt (classic Subsonic: token = md5(password + salt)), or
//   - username + password — the password is converted to a random-salted token
//     in the browser, so the plaintext password is never sent on the wire.
export interface SubsonicConfig {
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
  scrobble?: boolean; // send Subsonic scrobble on play (now-playing + submission); default true
  cache?: boolean; // cache resolved song ids in localStorage; default true
  resolutionCache?: ResolutionCache; // injectable cache (tests / custom backend)
}

const API_VERSION = '1.16.1';
const CLIENT_NAME = 'byom-player';

// Last.fm-style scrobble rule: submit once playback passes half the track or
// 4 minutes, whichever comes first; never submit tracks under 30 seconds.
const SCROBBLE_MIN_DURATION_S = 30;
const SCROBBLE_MAX_DELAY_S = 240;

// SubsonicProvider resolves a Track against a Subsonic/OpenSubsonic server and
// plays the resulting stream via an HTML5 Audio element.
export class SubsonicProvider implements AudioProvider {
  name = 'subsonic';

  private readonly audio = new Audio();
  private readonly cfg: SubsonicConfig;
  private readonly listeners = new AbortController();
  private callback: (state: ProviderState) => void = () => {};
  private progressCallback: (positionMs: number, durationMs: number) => void = () => {};
  // Resolved token auth: provided directly, or derived from a password + salt.
  private readonly authToken?: string;
  private readonly authSalt?: string;
  // Per-track scrobble state (reset in load()).
  private currentId: string | null = null;
  private nowPlayingSent = false;
  private submitted = false;
  // Resolved-id cache, keyed per server. null when caching is disabled.
  private readonly cache: ResolutionCache | null;
  private readonly scope: string;
  // Stale-id recovery state (reset in load()).
  private currentTrack: Track | null = null;
  private currentKey: string | null = null;
  private currentIdFromCache = false;
  private retriedStale = false;
  private hasPlayed = false;

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as SubsonicConfig;

    this.scope = 'subsonic:' + this.cfg.baseUrl.replace(/\/$/, '');
    this.cache =
      this.cfg.cache === false
        ? null
        : (this.cfg.resolutionCache ?? new LocalStorageResolutionCache());

    if (this.cfg.token && this.cfg.salt) {
      this.authToken = this.cfg.token;
      this.authSalt = this.cfg.salt;
    } else if (this.cfg.password) {
      // Derive token+salt so the plaintext password never leaves the browser.
      this.authSalt = randomSalt();
      this.authToken = md5(this.cfg.password + this.authSalt);
    }

    const opts = { signal: this.listeners.signal };
    this.audio.addEventListener(
      'playing',
      () => {
        this.hasPlayed = true;
        this.callback('playing');
        this.sendNowPlaying();
      },
      opts,
    );
    this.audio.addEventListener('pause', () => this.callback('paused'), opts);
    this.audio.addEventListener('ended', () => this.callback('ended'), opts);
    this.audio.addEventListener('error', () => this.handleAudioError(), opts);
    this.audio.addEventListener('timeupdate', () => this.emitProgress(), opts);
    this.audio.addEventListener('durationchange', () => this.emitProgress(), opts);
  }

  private emitProgress(): void {
    const durationS = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.progressCallback(this.audio.currentTime * 1000, durationS * 1000);
    this.maybeSubmit(this.audio.currentTime, durationS);
  }

  private scrobbleEnabled(): boolean {
    return this.cfg.scrobble !== false; // default on
  }

  private sendNowPlaying(): void {
    if (!this.currentId || this.nowPlayingSent || !this.scrobbleEnabled()) return;
    this.nowPlayingSent = true;
    this.scrobble(this.currentId, false);
  }

  private maybeSubmit(positionS: number, durationS: number): void {
    if (!this.currentId || this.submitted || !this.scrobbleEnabled()) return;
    if (durationS < SCROBBLE_MIN_DURATION_S) return; // too short to count / unknown duration
    const threshold = Math.min(durationS / 2, SCROBBLE_MAX_DELAY_S);
    if (positionS >= threshold) {
      this.submitted = true;
      this.scrobble(this.currentId, true);
    }
  }

  // scrobble notifies the server of a play. Fire-and-forget: it never awaits,
  // never routes through the retrying fetchJson, and never affects provider
  // state — a flaky scrobble must not disrupt playback or trip the breaker.
  // submission=false is a "now playing" ping; submission=true is a play count.
  // Navidrome also accepts the bare /rest/scrobble alias.
  private scrobble(id: string, submission: boolean): void {
    const url = this.url('scrobble.view', {
      id,
      submission: String(submission),
      time: String(Date.now()),
    });
    fetch(url).catch((err) => this.log('scrobble failed', err));
  }

  async initialize(): Promise<void> {
    this.callback('ready');
  }

  async load(track: Track): Promise<void> {
    this.currentId = null;
    this.nowPlayingSent = false;
    this.submitted = false;
    this.currentTrack = track;
    this.currentKey = trackKey(track);
    this.retriedStale = false;
    this.hasPlayed = false;
    this.currentIdFromCache = !!this.cache?.get(this.scope, this.currentKey);
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
    this.currentId = id;
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

  onProgress(callback: (positionMs: number, durationMs: number) => void): void {
    this.progressCallback = callback;
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
    const key = trackKey(track);
    const cached = this.cache?.get(this.scope, key);
    if (cached) {
      this.log('cache hit', track.artist, '-', track.title, '->', cached);
      return cached;
    }
    const query = `${track.artist} ${track.title}`.trim();
    const data = await this.fetchJson(this.url('search3.view', { query, songCount: '1' }));
    const id = data?.['subsonic-response']?.searchResult3?.song?.[0]?.id ?? null;
    if (id) this.cache?.set(this.scope, key, id);
    return id;
  }

  // clearCache drops this server's cached ids (e.g. after a library rescan).
  clearCache(): void {
    this.cache?.clear(this.scope);
  }

  // handleAudioError distinguishes a stale cached id (errors before it ever
  // plays) from a genuine/transient failure. For the former, evict the entry
  // and re-resolve live once; otherwise surface 'error' as usual.
  private handleAudioError(): void {
    if (
      !this.hasPlayed &&
      this.currentIdFromCache &&
      !this.retriedStale &&
      this.cache &&
      this.currentTrack &&
      this.currentKey
    ) {
      this.retriedStale = true;
      this.cache.evict(this.scope, this.currentKey);
      this.log(
        'cached id failed; re-resolving',
        this.currentTrack.artist,
        '-',
        this.currentTrack.title,
      );
      void this.reloadFresh(this.currentTrack);
      return;
    }
    this.callback('error');
  }

  // reloadFresh re-resolves after evicting a stale id, then resumes playback.
  private async reloadFresh(track: Track): Promise<void> {
    this.currentIdFromCache = false;
    let id: string | null;
    try {
      id = await this.resolve(track); // cache was evicted -> hits search3, re-caches
    } catch {
      this.callback('error');
      return;
    }
    if (!id) {
      this.callback('unavailable');
      return;
    }
    this.currentId = id;
    this.audio.src = this.streamUrl(id);
    void this.play();
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
    if (this.cfg.apiKey) {
      params.set('apiKey', this.cfg.apiKey);
    } else if (this.authToken && this.authSalt) {
      if (this.cfg.username) params.set('u', this.cfg.username);
      params.set('t', this.authToken);
      params.set('s', this.authSalt);
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

// randomSalt returns a random hex salt for Subsonic token auth.
function randomSalt(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
