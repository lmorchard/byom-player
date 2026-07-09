import type { Track } from '../../types';
import type { AudioProvider, AvailabilityStatus, ProviderState } from '../types';
import { trackKey, LocalStorageResolutionCache, type ResolutionCache } from '../resolutionCache';
import type { PlexConfig } from './types';

// Pull the first track's direct-play Part key out of a Plex search response.
// Tolerates both /library/search (SearchResult[].Metadata) and older Metadata[].
export function firstTrackPartKey(data: unknown): string | null {
  const mc = (data as { MediaContainer?: Record<string, unknown> })?.MediaContainer;
  if (!mc) return null;
  const fromSearch = Array.isArray(mc.SearchResult)
    ? (mc.SearchResult as { Metadata?: unknown }[]).map((r) => r?.Metadata)
    : [];
  const fromMeta = Array.isArray(mc.Metadata) ? (mc.Metadata as unknown[]) : [];
  for (const m of [...fromSearch, ...fromMeta].filter(Boolean) as Record<string, any>[]) {
    if (m.type && m.type !== 'track') continue;
    const key = m?.Media?.[0]?.Part?.[0]?.key;
    if (typeof key === 'string') return key;
  }
  return null;
}

// PlexProvider resolves a Track against a Plex Media Server's music library and
// plays the resulting direct-play stream via an HTML5 Audio element. Mirrors
// SubsonicProvider; no engine seam.
export class PlexProvider implements AudioProvider {
  name = 'plex';

  private readonly audio = new Audio();
  private readonly cfg: PlexConfig;
  private readonly listeners = new AbortController();
  private readonly cache: ResolutionCache | null;
  private callback: (s: ProviderState) => void = () => {};
  private progressCallback: (positionMs: number, durationMs: number) => void = () => {};

  // Session (base + token). Set from config here; the PIN flow sets it in Task 4.
  protected base = '';
  protected token = '';

  // Stale-id recovery state (reset in load()).
  private currentTrack: Track | null = null;
  private currentKey: string | null = null;
  private currentFromCache = false;
  private retriedStale = false;
  private hasPlayed = false;

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as PlexConfig;
    this.base = (this.cfg.baseUrl ?? '').replace(/\/$/, '');
    this.token = this.cfg.token ?? '';
    this.cache =
      this.cfg.cache === false
        ? null
        : (this.cfg.resolutionCache ?? new LocalStorageResolutionCache());

    const opts = { signal: this.listeners.signal };
    this.audio.addEventListener(
      'playing',
      () => {
        this.hasPlayed = true;
        this.callback('playing');
      },
      opts,
    );
    this.audio.addEventListener('pause', () => this.callback('paused'), opts);
    this.audio.addEventListener('ended', () => this.callback('ended'), opts);
    this.audio.addEventListener('error', () => this.handleAudioError(), opts);
    this.audio.addEventListener('timeupdate', () => this.emitProgress(), opts);
    this.audio.addEventListener('durationchange', () => this.emitProgress(), opts);
  }

  private get scope(): string {
    return 'plex:' + this.base;
  }

  async initialize(): Promise<void> {
    // Token-in path (Task 1). The PIN / cached-session paths are added in Task 4.
    this.callback('ready');
  }

  async load(track: Track): Promise<void> {
    this.currentTrack = track;
    this.currentKey = trackKey(track);
    this.retriedStale = false;
    this.hasPlayed = false;
    this.currentFromCache = !!this.cache?.get(this.scope, this.currentKey);
    let key: string | null;
    try {
      key = await this.resolve(track);
    } catch (err) {
      this.log('resolve error', track.artist, '-', track.title, err);
      this.callback('error');
      return;
    }
    if (!key) {
      this.log('not in library', track.artist, '-', track.title);
      this.callback('unavailable');
      return;
    }
    this.audio.src = this.streamUrl(key);
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
  onStateChange(cb: (s: ProviderState) => void): void {
    this.callback = cb;
  }
  onProgress(cb: (positionMs: number, durationMs: number) => void): void {
    this.progressCallback = cb;
  }
  dispose(): void {
    this.listeners.abort();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  async resolve(track: Track): Promise<string | null> {
    const key = trackKey(track);
    const cached = this.cache?.get(this.scope, key);
    if (cached) return cached;
    if (cached === null) return null;
    const query = `${track.artist} ${track.title}`.trim();
    const data = await this.fetchJson(
      this.apiUrl('/library/search', { query, searchTypes: 'music', limit: '5' }),
    );
    const partKey = firstTrackPartKey(data);
    if (partKey) this.cache?.set(this.scope, key, partKey);
    else this.cache?.setMiss(this.scope, key);
    return partKey;
  }

  async checkAvailability(track: Track): Promise<AvailabilityStatus> {
    try {
      return (await this.resolve(track)) ? 'available' : 'unavailable';
    } catch {
      return 'unknown';
    }
  }

  streamUrl(partKey: string): string {
    const url = new URL(this.base + partKey);
    url.searchParams.set('X-Plex-Token', this.token);
    return url.toString();
  }

  private apiUrl(path: string, params: Record<string, string> = {}): string {
    const url = new URL(this.base + path);
    url.searchParams.set('X-Plex-Token', this.token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }

  private async fetchJson(url: string): Promise<unknown> {
    const retries = this.cfg.retries ?? 2;
    const baseDelay = this.cfg.retryDelayMs ?? 400;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        if (attempt >= retries) throw err;
        await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
      }
    }
  }

  // A cached part key that errors before ever playing is likely stale (library
  // rescan changed part ids): evict and re-resolve once. Mirrors Subsonic.
  private handleAudioError(): void {
    if (
      !this.hasPlayed &&
      this.currentFromCache &&
      !this.retriedStale &&
      this.cache &&
      this.currentTrack &&
      this.currentKey
    ) {
      this.retriedStale = true;
      this.cache.evict(this.scope, this.currentKey);
      void this.reloadFresh(this.currentTrack);
      return;
    }
    this.callback('error');
  }

  private async reloadFresh(track: Track): Promise<void> {
    this.currentFromCache = false;
    let key: string | null;
    try {
      key = await this.resolve(track);
    } catch {
      this.callback('error');
      return;
    }
    if (!key) {
      this.callback('unavailable');
      return;
    }
    this.audio.src = this.streamUrl(key);
    void this.play();
  }

  private emitProgress(): void {
    const durationS = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.progressCallback(this.audio.currentTime * 1000, durationS * 1000);
  }

  private log(...args: unknown[]): void {
    if (this.cfg.debug) console.debug('[byom-player:plex]', ...args);
  }
}
