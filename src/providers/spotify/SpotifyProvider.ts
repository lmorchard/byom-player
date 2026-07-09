import type { Track } from '../../types';
import type { AudioProvider, ProviderState, AvailabilityStatus } from '../types';
import { AuthClient } from './auth';
import { WebPlaybackEngine } from './WebPlaybackEngine';
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

  // Pick a playback tier: embed when forced, otherwise the SDK when a token is
  // available (falling back to embed for non-Premium), or a connect button.
  async initialize(): Promise<void> {
    if (this.cfg.forceEmbed) {
      await this.useEngine('embed');
      this.stateCallback('ready');
      return;
    }
    const token = await this.auth.getValidToken();
    if (!token) {
      this.renderConnect();
      this.stateCallback('ready');
      return;
    }
    await this.connectWithFallback();
  }

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
    this.stateCallback('ready');
  }

  private renderConnect(): void {
    if (!this.target) return;
    this.target.replaceChildren();
    const btn = this.target.ownerDocument.createElement('button');
    btn.textContent = 'Connect Spotify';
    btn.className = 'byom-spotify-connect';
    btn.addEventListener('click', () => {
      void this.handleConnectClick(btn);
    });
    this.target.appendChild(btn);
  }

  private async handleConnectClick(btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    try {
      await this.auth.login();
      this.target?.replaceChildren(); // clear the button before mounting an engine
      await this.connectWithFallback();
    } catch (err) {
      this.log('login failed', err);
      btn.disabled = false;
      this.stateCallback('error');
    }
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

  dispose(): void {
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
    throw new Error('EmbedEngine not yet implemented'); // replaced in Task 6
  }

  protected async useEngine(kind: EngineKind): Promise<void> {
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
