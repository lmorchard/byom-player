import type { Track } from '../../types';
import type { AudioProvider, ProviderState, AvailabilityStatus, AuthState } from '../types';
import { AuthClient } from './auth';
import { WebPlaybackEngine } from './WebPlaybackEngine';
import { EmbedEngine } from './EmbedEngine';
import {
  NotPremiumError,
  type SpotifyConfig,
  type SpotifyEngine,
  type EngineKind,
  type AuthLike,
} from './types';

const PROGRESS_TICK_MS = 250;

// Parse a Spotify track id from an open.spotify.com URL or a spotify: URI.
export function parseSpotifyId(url?: string): string | null {
  if (!url) return null;
  const uri = url.match(/^spotify:track:([A-Za-z0-9]+)/);
  if (uri) return uri[1];
  const web = url.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  if (web) return web[1];
  return null;
}

// Plays JSPF tracks through Spotify. Resolution parses the track's spotifyUrl;
// playback goes through a WebPlaybackEngine (Premium) or EmbedEngine fallback.
export class SpotifyProvider implements AudioProvider {
  name = 'spotify';

  private readonly cfg: SpotifyConfig;
  private readonly auth: AuthLike;
  private engine: SpotifyEngine | null = null;
  private target: HTMLElement | null = null;
  private disposed = false;
  private connected = false;
  private busy = false;
  private authCallback: () => void = () => {};
  private stateCallback: (s: ProviderState) => void = () => {};
  private progressCallback: (pos: number, dur: number) => void = () => {};
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as SpotifyConfig;
    this.auth = this.cfg.auth ?? new AuthClient(this.cfg);
  }

  attach(element: HTMLElement): void {
    this.target = element;
  }

  // Pick a playback tier: embed when forced; otherwise the SDK when a token is
  // available (falling back to embed for non-Premium), or the embed while
  // disconnected (the panel shows a Connect button to upgrade to the SDK).
  async initialize(): Promise<void> {
    // Without a client id (or when forced), there's no OAuth/SDK path — run
    // embed-only and offer no Connect option.
    if (!this.canConnect) {
      await this.useEngine('embed');
      this.stateCallback('ready');
      return;
    }
    const token = await this.auth.getValidToken();
    if (token) await this.connectWithFallback();
    else await this.enterDisconnected();
  }

  // The SDK/OAuth tier needs a client id and mustn't be force-embedded.
  private get canConnect(): boolean {
    return !this.cfg.forceEmbed && !!this.cfg.clientId;
  }

  // --- interactive auth (rendered declaratively by the host settings panel) ---

  getAuthState(): AuthState {
    // Embed-only (no client id / forced): nothing to connect — the host hides
    // the connection section when there are no actions.
    if (!this.canConnect) return { actions: [] };
    return this.connected
      ? {
          status: 'Connected',
          actions: [{ id: 'disconnect', label: 'Disconnect Spotify' }],
          busy: this.busy,
        }
      : {
          status: 'Not connected',
          actions: [{ id: 'connect', label: 'Connect Spotify' }],
          busy: this.busy,
        };
  }

  onAuthChange(cb: () => void): void {
    this.authCallback = cb;
  }

  async runAuthAction(id: string): Promise<void> {
    if (id === 'connect') {
      this.busy = true;
      this.notifyAuth();
      try {
        await this.auth.login();
        await this.connectWithFallback();
      } catch (err) {
        this.log('login failed', err);
        this.stateCallback('error');
      } finally {
        this.busy = false;
        this.notifyAuth();
      }
    } else if (id === 'disconnect') {
      this.auth.logout();
      await this.enterDisconnected();
    }
  }

  private notifyAuth(): void {
    this.authCallback();
  }

  // Disconnected: play through the embed (works for a viewer already signed into
  // Spotify — full tracks if Premium, 30s previews if free).
  private async enterDisconnected(): Promise<void> {
    await this.useEngine('embed');
    this.connected = false;
    this.notifyAuth();
    this.stateCallback('ready');
  }

  // With a token in hand, try the SDK, falling back to the embed for non-Premium
  // accounts.
  private async connectWithFallback(): Promise<void> {
    try {
      await this.useEngine('sdk');
    } catch (err) {
      if (err instanceof NotPremiumError) {
        this.log('account not premium — falling back to embed');
        await this.useEngine('embed');
      } else {
        this.log('sdk connect error', err);
        this.stateCallback('error');
        return;
      }
    }
    this.connected = true;
    this.notifyAuth();
    this.stateCallback('ready');
  }

  async load(track: Track): Promise<void> {
    const id = parseSpotifyId(track.spotifyUrl);
    if (!id) {
      this.log('no spotify url', track.artist, '-', track.title);
      this.stateCallback('unavailable');
      return;
    }
    await this.engine?.load(`spotify:track:${id}`);
  }

  async play(): Promise<void> {
    this.engine?.play();
  }
  pause(): void {
    this.engine?.pause();
  }
  seek(positionMs: number): void {
    this.engine?.seek(positionMs);
  }
  onStateChange(cb: (s: ProviderState) => void): void {
    this.stateCallback = cb;
  }
  onProgress(cb: (pos: number, dur: number) => void): void {
    this.progressCallback = cb;
  }

  async checkAvailability(track: Track): Promise<AvailabilityStatus> {
    return parseSpotifyId(track.spotifyUrl) ? 'available' : 'unavailable';
  }

  // checkAvailability is a network-less parse of the track's Spotify URL in every
  // case (URL → available, none → unavailable), so the sweep never needs to
  // throttle — there's no server to be gentle with, whatever the answer.
  isResolutionCached(): boolean {
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.stopTicker();
    this.engine?.destroy();
    this.engine = null;
  }

  // --- internals ---

  protected makeEngine(kind: EngineKind): SpotifyEngine {
    if (this.cfg.engineFactory)
      return this.cfg.engineFactory(kind, () => this.auth.getValidToken());
    const getToken = () => this.auth.getValidToken();
    if (kind === 'sdk') return new WebPlaybackEngine(this.cfg, getToken);
    return new EmbedEngine();
  }

  protected async useEngine(kind: EngineKind): Promise<void> {
    // A provider replaced mid-init (async token check still in flight) must not
    // mount an engine into the now-shared .video region.
    if (this.disposed) return;
    // Tear down any current engine and its DOM so engines can be swapped cleanly
    // on connect/disconnect.
    this.stopTicker();
    this.engine?.destroy();
    this.engine = null;
    if (this.target) this.target.replaceChildren();

    const engine = this.makeEngine(kind);
    engine.onState((s) => this.handleState(s));
    if (this.target) engine.attach(this.target);
    this.engine = engine;
    await engine.ready();
  }

  private handleState(s: ProviderState): void {
    this.stateCallback(s);
    if (s === 'playing') this.startTicker();
    else this.stopTicker();
  }

  private startTicker(): void {
    this.stopTicker();
    this.tick();
    this.ticker = setInterval(() => this.tick(), PROGRESS_TICK_MS);
  }
  private tick(): void {
    if (this.engine) this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs());
  }
  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
  private log(...args: unknown[]): void {
    if (this.cfg.debug) console.debug('[byom-player:spotify]', ...args);
  }
}
