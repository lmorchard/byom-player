import type { Track } from '../../types';
import type { AudioProvider, AvailabilityStatus, ProviderState } from '../types';
import { trackKey, LocalStorageResolutionCache, type ResolutionCache } from '../resolutionCache';
import { PlexAuth } from './auth';
import type { PlexAuthLike, PlexConfig, PlexSession } from './types';

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

  // Session (base + token): from config (token-in), a cached link, or the PIN flow.
  protected base = '';
  protected token = '';
  private readonly auth?: PlexAuthLike;
  private target: HTMLElement | null = null;
  private resetCallback: () => void = () => {};

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
    // Token-in config needs no auth client; otherwise use the PIN/discovery client.
    this.auth =
      this.cfg.auth ?? (this.cfg.baseUrl && this.cfg.token ? undefined : new PlexAuth(this.cfg));

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

  // A usable session needs both a server and a token. Until then we must not
  // probe the server (the background prescan would 401 on every track).
  private get authed(): boolean {
    return !!(this.base && this.token);
  }

  attach(element: HTMLElement): void {
    this.target = element;
  }

  onReset(cb: () => void): void {
    this.resetCallback = cb;
  }

  async initialize(): Promise<void> {
    if (this.base && this.token) {
      this.callback('ready'); // token-in config
      return;
    }
    const existing = await this.auth?.getSession();
    if (existing) {
      this.applySession(existing);
      this.renderUnlink();
      this.callback('ready');
      return;
    }
    this.renderLink();
    this.callback('ready');
  }

  private applySession(s: PlexSession): void {
    this.base = s.baseUrl.replace(/\/$/, '');
    this.token = s.token;
  }

  private renderLink(): void {
    if (!this.target) return;
    this.target.replaceChildren();
    const btn = this.target.ownerDocument.createElement('button');
    btn.className = 'byom-plex-link';
    btn.textContent = 'Link Plex';
    btn.addEventListener('click', () => void this.handleLink(btn));
    this.target.appendChild(btn);
  }

  private async handleLink(btn: HTMLButtonElement): Promise<void> {
    if (!this.auth) return;
    btn.disabled = true;
    try {
      const result = await this.auth.link();
      if ('servers' in result) {
        this.renderPicker(result.servers);
        return;
      }
      this.applySession(result);
      this.renderUnlink();
    } catch (err) {
      this.log('link failed', err);
      btn.disabled = false;
      this.callback('error');
    }
  }

  private renderPicker(servers: { id: string; name: string }[]): void {
    if (!this.target) return;
    this.target.replaceChildren();
    for (const s of servers) {
      const b = this.target.ownerDocument.createElement('button');
      b.className = 'byom-plex-server';
      b.textContent = s.name;
      b.addEventListener('click', () => void this.handlePick(s.id));
      this.target.appendChild(b);
    }
  }

  private async handlePick(id: string): Promise<void> {
    if (!this.auth?.selectServer) return;
    try {
      this.applySession(await this.auth.selectServer(id));
      this.renderUnlink();
    } catch (err) {
      this.log('server select failed', err);
      this.callback('error');
    }
  }

  private renderUnlink(): void {
    if (!this.target) return;
    this.target.replaceChildren();
    const btn = this.target.ownerDocument.createElement('button');
    btn.className = 'byom-plex-unlink';
    btn.textContent = 'Unlink Plex';
    btn.addEventListener('click', () => void this.handleUnlink());
    this.target.appendChild(btn);
  }

  private handleUnlink(): void {
    this.auth?.logout();
    this.base = '';
    this.token = '';
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.renderLink();
    this.resetCallback(); // clear stale availability marks in the host
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
    if (!this.authed) return 'unknown'; // not linked yet — don't probe the server
    try {
      return (await this.resolve(track)) ? 'available' : 'unavailable';
    } catch {
      return 'unknown';
    }
  }

  // Lets the availability sweep skip its cooldown for tracks it can answer from
  // cache without touching the server (a hit or a known miss both qualify).
  isResolutionCached(track: Track): boolean {
    if (!this.authed) return false;
    return this.cache?.get(this.scope, trackKey(track)) !== undefined;
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
