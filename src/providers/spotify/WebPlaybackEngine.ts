// Real Spotify Web Playback SDK engine (Premium). Browser-only; not unit-tested.
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

  async ready(): Promise<void> {
    await loadSdk();
    this.player = new window.Spotify.Player({
      name: this.cfg.deviceName ?? 'byom-player',
      getOAuthToken: (cb: (t: string) => void) => {
        void this.getToken().then((t) => {
          if (t) cb(t);
        });
      },
      volume: 1.0,
    });

    this.player.addListener('player_state_changed', (s: any) => {
      this.lastState = s;
      if (s) this.stateCb(s.paused ? 'paused' : 'playing');
    });

    await new Promise<void>((resolve, reject) => {
      this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
        this.deviceId = device_id;
        resolve();
      });
      this.player.addListener('account_error', ({ message }: { message: string }) =>
        reject(new NotPremiumError(message)),
      );
      this.player.addListener('authentication_error', ({ message }: { message: string }) =>
        reject(new Error(`Spotify auth error: ${message}`)),
      );
      this.player.addListener('initialization_error', ({ message }: { message: string }) =>
        reject(new Error(`Spotify init error: ${message}`)),
      );
      this.player.connect();
    });
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
  destroy(): void {
    this.player?.disconnect?.();
    this.player = null;
  }
}
