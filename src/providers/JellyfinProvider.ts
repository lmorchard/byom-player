import type { Track } from '../types';
import type { AudioProvider, AvailabilityStatus, ProviderState } from './types';
import { trackKey, LocalStorageResolutionCache, type ResolutionCache } from './resolutionCache';

// Config for the Jellyfin provider. Two auth modes:
//   - token-in: pass `token` (a Jellyfin API key or access token) + `baseUrl`.
//     API keys aren't user-scoped, so pass `userId` too if you have one.
//   - login: pass `username` + `password`; initialize() calls
//     /Users/AuthenticateByName to obtain an access token and the user id.
export interface JellyfinConfig {
  baseUrl: string;
  token?: string;
  userId?: string;
  username?: string;
  password?: string;
  // Client identity for the Authorization header (Jellyfin wants it on the auth
  // call). Sensible defaults; deviceId is generated + persisted when omitted so a
  // browser keeps a stable device across reloads.
  clientName?: string;
  deviceName?: string;
  deviceId?: string;
  clientVersion?: string;
  cache?: boolean; // cache resolved ids in localStorage; default true
  resolutionCache?: ResolutionCache; // injectable cache (tests / custom backend)
  debug?: boolean;
}

// Containers/codecs browsers reliably play. Advertised to the `universal`
// endpoint so Jellyfin direct-plays compatible sources and transcodes the rest
// (e.g. FLAC/ALAC) into one of these instead of serving something unplayable.
const STREAM_CONTAINERS = 'mp3,aac,m4a,ogg,oga,opus,webm,wav';
const STREAM_AUDIO_CODECS = 'aac,mp3';

const DEVICE_ID_KEY = 'byom-player:jellyfin:deviceId';

// normalizeName lowercases + collapses whitespace for loose comparison (some
// Jellyfin artist tags carry trailing spaces / case differences).
function normalizeName(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().replace(/\s+/g, ' ').trim() : '';
}

// artistMatches reports whether a search result's artist(s) plausibly match the
// wanted artist — normalized, and matching if either string contains the other
// (handles "feat." suffixes, "The" prefixes, etc. loosely).
function artistMatches(item: Record<string, unknown>, wanted: string): boolean {
  if (!wanted) return false;
  const candidates = [
    ...(Array.isArray(item.Artists) ? (item.Artists as unknown[]) : []),
    item.AlbumArtist,
  ].map(normalizeName);
  return candidates.some((c) => c && (c === wanted || c.includes(wanted) || wanted.includes(c)));
}

// pickAudioItemId chooses the best Audio item from an /Items search response.
// Jellyfin's searchTerm matches the track NAME only, so a search returns every
// track sharing that title across artists; we disambiguate here — the first
// artist match, else the first result (title already matched server-side).
export function pickAudioItemId(data: unknown, artist: string): string | null {
  const items = (data as { Items?: unknown })?.Items;
  if (!Array.isArray(items)) return null;
  const audio = (items as Record<string, unknown>[]).filter(
    (i) => (!i?.Type || i.Type === 'Audio') && typeof i?.Id === 'string',
  );
  if (!audio.length) return null;
  const want = normalizeName(artist);
  const match = audio.find((i) => artistMatches(i, want));
  return (match ?? audio[0]).Id as string;
}

// JellyfinProvider resolves a Track against a Jellyfin server's music library
// and plays the resulting stream via an HTML5 Audio element. Direct-URL family,
// mirrors PlexProvider (no engine seam); auth is a plain credential POST rather
// than Plex's PIN flow.
export class JellyfinProvider implements AudioProvider {
  name = 'jellyfin';

  private readonly audio = new Audio();
  private readonly cfg: JellyfinConfig;
  private readonly listeners = new AbortController();
  private readonly cache: ResolutionCache | null;
  private callback: (s: ProviderState) => void = () => {};
  private progressCallback: (positionMs: number, durationMs: number) => void = () => {};

  protected base = '';
  protected token = '';
  private userId = '';
  private readonly deviceId: string;

  // Stale-id recovery state (reset in load()).
  private currentTrack: Track | null = null;
  private currentKey: string | null = null;
  private currentFromCache = false;
  private retriedStale = false;
  private hasPlayed = false;

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as JellyfinConfig;
    this.base = (this.cfg.baseUrl ?? '').replace(/\/$/, '');
    this.token = this.cfg.token ?? '';
    this.userId = this.cfg.userId ?? '';
    this.deviceId = this.cfg.deviceId ?? loadOrCreateDeviceId();
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
    return 'jellyfin:' + this.base;
  }

  // A usable session needs a server and a token. Until then we must not probe
  // the server (the background prescan would 401 on every track).
  private get authed(): boolean {
    return !!(this.base && this.token);
  }

  async initialize(): Promise<void> {
    if (this.authed) {
      this.callback('ready'); // token-in config
      return;
    }
    if (this.base && this.cfg.username && this.cfg.password) {
      try {
        await this.authenticate(this.cfg.username, this.cfg.password);
      } catch (err) {
        this.log('authentication failed', err);
        this.callback('error');
        return;
      }
    }
    this.callback('ready');
  }

  // POST /Users/AuthenticateByName -> { AccessToken, User: { Id } }. The initial
  // call carries only client identity in the Authorization header (no token yet).
  private async authenticate(username: string, password: string): Promise<void> {
    const res = await fetch(this.apiUrl('/Users/AuthenticateByName'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: this.authHeader(),
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { AccessToken?: string; User?: { Id?: string } };
    if (!data.AccessToken) throw new Error('no AccessToken in auth response');
    this.token = data.AccessToken;
    this.userId = data.User?.Id ?? this.userId;
  }

  // The Authorization header for the AuthenticateByName POST: client identity
  // only (no token yet). Once authenticated, all other requests carry the token
  // as an api_key query param instead (see apiUrl / streamUrl).
  private authHeader(): string {
    return [
      `MediaBrowser Client="${this.cfg.clientName ?? 'byom-player'}"`,
      `Device="${this.cfg.deviceName ?? 'byom-player'}"`,
      `DeviceId="${this.deviceId}"`,
      `Version="${this.cfg.clientVersion ?? '0.1.0'}"`,
    ].join(', ');
  }

  async load(track: Track): Promise<void> {
    this.currentTrack = track;
    this.currentKey = trackKey(track);
    this.retriedStale = false;
    this.hasPlayed = false;
    this.currentFromCache = !!this.cache?.get(this.scope, this.currentKey);
    let id: string | null;
    try {
      id = await this.resolve(track);
    } catch (err) {
      this.log('resolve error', track.artist, '-', track.title, err);
      this.callback('error');
      return;
    }
    if (!id) {
      this.log('not in library', track.artist, '-', track.title);
      this.callback('unavailable');
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

  // resolve: search the library for "{artist} {title}", return the first Audio
  // item's id. Caches hits; negative-caches misses.
  async resolve(track: Track): Promise<string | null> {
    const key = trackKey(track);
    const cached = this.cache?.get(this.scope, key);
    if (cached) return cached;
    if (cached === null) return null;
    const params: Record<string, string> = {
      searchTerm: track.title.trim(),
      includeItemTypes: 'Audio',
      recursive: 'true',
      limit: '10',
      fields: 'Artists',
    };
    if (this.userId) params.userId = this.userId;
    const data = await this.fetchJson(this.apiUrl('/Items', params));
    const id = pickAudioItemId(data, track.artist);
    if (id) this.cache?.set(this.scope, key, id);
    else this.cache?.setMiss(this.scope, key);
    return id;
  }

  async checkAvailability(track: Track): Promise<AvailabilityStatus> {
    if (!this.authed) return 'unknown'; // no token yet — don't probe the server
    try {
      return (await this.resolve(track)) ? 'available' : 'unavailable';
    } catch {
      return 'unknown';
    }
  }

  // Lets the availability sweep skip its cooldown when a check won't hit the
  // server: unauthed (checkAvailability short-circuits to 'unknown'), or a
  // cached hit / known miss.
  isResolutionCached(track: Track): boolean {
    if (!this.authed) return true;
    return this.cache?.get(this.scope, trackKey(track)) !== undefined;
  }

  // /Audio/{id}/universal streams with the token as a query param (an <audio>
  // src can't carry an Authorization header). The container/codec list lets
  // Jellyfin direct-play browser-friendly sources and transcode the rest.
  streamUrl(itemId: string): string {
    const url = new URL(`${this.base}/Audio/${itemId}/universal`);
    url.searchParams.set('api_key', this.token);
    url.searchParams.set('deviceId', this.deviceId);
    if (this.userId) url.searchParams.set('userId', this.userId);
    url.searchParams.set('container', STREAM_CONTAINERS);
    url.searchParams.set('audioCodec', STREAM_AUDIO_CODECS);
    return url.toString();
  }

  // API URLs carry the token as an api_key query param (like streamUrl). This
  // keeps GETs as simple CORS requests — no Authorization header means no
  // preflight — matching how the Subsonic/Navidrome provider authenticates.
  private apiUrl(path: string, params: Record<string, string> = {}): string {
    const url = new URL(this.base + path);
    if (this.token) url.searchParams.set('api_key', this.token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }

  private async fetchJson(url: string): Promise<unknown> {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // A cached id that errors before ever playing is likely stale (library rescan
  // changed item ids): evict and re-resolve once. Mirrors Plex/Subsonic.
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
    let id: string | null;
    try {
      id = await this.resolve(track);
    } catch {
      this.callback('error');
      return;
    }
    if (!id) {
      this.callback('unavailable');
      return;
    }
    this.audio.src = this.streamUrl(id);
    void this.play();
  }

  private emitProgress(): void {
    const durationS = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.progressCallback(this.audio.currentTime * 1000, durationS * 1000);
  }

  private log(...args: unknown[]): void {
    if (this.cfg.debug) console.debug('[byom-player:jellyfin]', ...args);
  }
}

// loadOrCreateDeviceId keeps a stable per-browser device id in localStorage so
// Jellyfin sees one consistent device across reloads. Falls back to an ephemeral
// id when storage is unavailable.
function loadOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
