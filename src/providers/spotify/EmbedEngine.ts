// Real Spotify embed IFrame engine (free/preview tier). Browser-only; not unit-tested.
import type { ProviderState } from '../types';
import type { SpotifyEngine } from './types';

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void;
  }
}
interface SpotifyIFrameApi {
  createController(
    el: HTMLElement,
    opts: { uri?: string; width?: string | number; height?: string | number },
    cb: (controller: EmbedController) => void,
  ): void;
}
interface EmbedController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  destroy(): void;
  addListener(event: string, cb: (e: any) => void): void;
}

const IFRAME_API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
const END_EPSILON_MS = 750;

let apiReady: Promise<SpotifyIFrameApi> | null = null;
function loadIframeApi(): Promise<SpotifyIFrameApi> {
  if (apiReady) return apiReady;
  apiReady = new Promise<SpotifyIFrameApi>((resolve) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    const tag = document.createElement('script');
    tag.src = IFRAME_API_SRC;
    document.head.appendChild(tag);
  });
  return apiReady;
}

export class EmbedEngine implements SpotifyEngine {
  private controller: EmbedController | null = null;
  private target: HTMLElement | null = null;
  private posMs = 0;
  private durMs = 0;
  private stateCb: (s: ProviderState) => void = () => {};

  attach(element: HTMLElement): void {
    this.target = element;
  }

  async ready(): Promise<void> {
    const api = await loadIframeApi();
    const host = this.target ?? document.body;
    const holder = document.createElement('div');
    host.appendChild(holder);
    await new Promise<void>((resolve) => {
      api.createController(holder, { width: '100%', height: 152 }, (controller) => {
        this.controller = controller;
        controller.addListener('ready', () => resolve());
        controller.addListener(
          'playback_update',
          (e: { data: { isPaused: boolean; position: number; duration: number } }) => {
            this.posMs = e.data.position;
            this.durMs = e.data.duration;
            if (this.durMs > 0 && this.posMs >= this.durMs - END_EPSILON_MS) {
              this.stateCb('ended');
            } else {
              this.stateCb(e.data.isPaused ? 'paused' : 'playing');
            }
          },
        );
      });
    });
  }

  async load(uri: string): Promise<void> {
    this.controller?.loadUri(uri);
  }
  play(): void {
    this.controller?.resume();
  }
  pause(): void {
    this.controller?.pause();
  }
  seek(positionMs: number): void {
    this.controller?.seek(positionMs / 1000);
  }
  currentTimeMs(): number {
    return this.posMs;
  }
  durationMs(): number {
    return this.durMs;
  }
  onState(cb: (s: ProviderState) => void): void {
    this.stateCb = cb;
  }
  destroy(): void {
    this.controller?.destroy();
    this.controller = null;
  }
}
