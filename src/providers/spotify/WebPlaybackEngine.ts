// Real Spotify Web Playback SDK engine (Premium). Browser-only; the SDK-driven
// paths aren't unit-tested, but the single-player reuse invariant is (see
// WebPlaybackEngine.test.ts).
import type { ProviderState } from '../types';
import { NotPremiumError, type SpotifyConfig, type SpotifyEngine } from './types';

declare global {
  interface Window {
    Spotify?: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
const PLAY_ENDPOINT = 'https://api.spotify.com/v1/me/player/play';

let sdkReady: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (sdkReady) return sdkReady;
  sdkReady = new Promise<void>((resolve) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = SDK_SRC;
    document.head.appendChild(tag);
  });
  return sdkReady;
}

// The Spotify Web Playback SDK is effectively a per-page singleton: it loads one
// hidden EME iframe and does NOT tolerate destroy-then-recreate. A recreated
// Player registers a device that Spotify then refuses to play to ("Device not
// found", 404) — which is what happened when a user left the Spotify provider
// and came back. So the page keeps ONE Player for its lifetime; engines (which
// are rebuilt on every provider switch) attach to it and detach on teardown
// rather than tearing the Player down.
interface PlayerHandle {
  player: any;
  deviceId: string;
}
let sharedPlayer: Promise<PlayerHandle> | null = null;
let currentEngine: WebPlaybackEngine | null = null;
function setCurrentEngine(engine: WebPlaybackEngine | null): void {
  currentEngine = engine;
}

function connectSharedPlayer(deviceName: string): Promise<PlayerHandle> {
  if (sharedPlayer) return sharedPlayer;
  sharedPlayer = (async () => {
    await loadSdk();
    // The Player's token + state callbacks delegate to whichever engine is
    // currently active, so the single Player follows provider switches.
    const player = new window.Spotify.Player({
      name: deviceName,
      getOAuthToken: (cb: (t: string) => void) => {
        void currentEngine?.token().then((t) => {
          if (t) cb(t);
        });
      },
      volume: 1.0,
    });
    player.addListener('player_state_changed', (s: any) => currentEngine?.handleRawState(s));
    try {
      return await new Promise<PlayerHandle>((resolve, reject) => {
        player.addListener('ready', ({ device_id }: { device_id: string }) =>
          resolve({ player, deviceId: device_id }),
        );
        player.addListener('account_error', ({ message }: { message: string }) =>
          reject(new NotPremiumError(message)),
        );
        player.addListener('authentication_error', ({ message }: { message: string }) =>
          reject(new Error(`Spotify auth error: ${message}`)),
        );
        player.addListener('initialization_error', ({ message }: { message: string }) =>
          reject(new Error(`Spotify init error: ${message}`)),
        );
        player.connect();
      });
    } catch (err) {
      // A failed connect (e.g. non-Premium) must not poison later attempts.
      sharedPlayer = null;
      throw err;
    }
  })();
  return sharedPlayer;
}

// test-only: reset the page-lifetime singleton between tests.
export function __resetSharedPlayer(): void {
  sharedPlayer = null;
  currentEngine = null;
}

export class WebPlaybackEngine implements SpotifyEngine {
  private player: any = null;
  private deviceId: string | null = null;
  private lastState: any = null;
  private stateCb: (s: ProviderState) => void = () => {};

  constructor(
    private readonly cfg: SpotifyConfig,
    private readonly getToken: () => Promise<string | null>,
  ) {}

  // Headless — no visible surface.
  attach(): void {}

  // Called by the shared Player to reach the active engine.
  token(): Promise<string | null> {
    return this.getToken();
  }
  handleRawState(s: any): void {
    this.lastState = s;
    if (s) this.stateCb(s.paused ? 'paused' : 'playing');
  }

  async ready(): Promise<void> {
    setCurrentEngine(this); // route the shared Player's token + state here
    const { player, deviceId } = await connectSharedPlayer(this.cfg.deviceName ?? 'byom-player');
    this.player = player;
    this.deviceId = deviceId;
  }

  async load(uri: string): Promise<void> {
    const token = await this.getToken();
    if (!token || !this.deviceId) throw new Error('Spotify device not ready');
    const res = await fetch(`${PLAY_ENDPOINT}?device_id=${encodeURIComponent(this.deviceId)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] }),
    });
    if (!res.ok && res.status !== 202 && res.status !== 204) {
      this.stateCb('error');
    }
  }

  play(): void {
    void this.player?.resume();
  }
  pause(): void {
    void this.player?.pause();
  }
  seek(positionMs: number): void {
    void this.player?.seek(positionMs);
  }
  currentTimeMs(): number {
    return this.lastState?.position ?? 0;
  }
  durationMs(): number {
    return this.lastState?.duration ?? 0;
  }
  onState(cb: (s: ProviderState) => void): void {
    this.stateCb = cb;
  }

  // Detach from the shared Player WITHOUT destroying it — recreating the SDK
  // Player breaks playback for the rest of the page (see the singleton note).
  // Pause so audio doesn't outlive the provider switch, and stop routing the
  // Player's callbacks to this now-defunct engine.
  destroy(): void {
    void this.player?.pause();
    if (currentEngine === this) setCurrentEngine(null);
    this.player = null;
  }
}
