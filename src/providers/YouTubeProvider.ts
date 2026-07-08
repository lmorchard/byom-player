import type { Track } from '../types';
import type { AudioProvider, ProviderState } from './types';

declare global {
  interface Window {
    // The YouTube IFrame API namespace (untyped; no @types dependency).
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Resolution config. Provide one:
//   - searchEndpoint: a backend that maps a query to a videoId. Called as
//     GET `${searchEndpoint}?q=<query>`; expected to return { videoId } (or a
//     YouTube-Data-API-shaped { items: [{ id: { videoId } }] }).
//   - apiKey: query the YouTube Data API directly. The key is visible to the
//     client, so this is for private/dev use only — never ship it in a public
//     bundle.
export interface YouTubeConfig {
  searchEndpoint?: string;
  apiKey?: string;
  // Injectable player engine (tests supply a fake; production uses the iframe).
  engine?: YouTubeEngine;
  debug?: boolean;
}

// YouTubeEngine abstracts the iframe player so the provider is unit-testable.
// All time values are milliseconds.
export interface YouTubeEngine {
  ready(): Promise<void>;
  // Render the player into a host-supplied element (visible video). When not
  // called, the engine plays through a hidden 1×1 iframe (audio-only).
  attach(element: HTMLElement): void;
  cue(videoId: string): void;
  play(): void;
  pause(): void;
  seek(positionMs: number): void;
  currentTimeMs(): number;
  durationMs(): number;
  onState(callback: (ytState: number) => void): void;
  destroy(): void;
}

// YouTube IFrame player state codes.
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_CUED = 5;
const YT_UNSTARTED = -1;
const PROGRESS_TICK_MS = 250;

// Map a YouTube player-state code to a ProviderState, or null to emit nothing
// (e.g. buffering).
export function mapYtState(yt: number): ProviderState | null {
  switch (yt) {
    case YT_ENDED:
      return 'ended';
    case YT_PLAYING:
      return 'playing';
    case YT_PAUSED:
      return 'paused';
    case YT_CUED:
    case YT_UNSTARTED:
      return 'ready';
    default:
      return null;
  }
}

// YouTubeProvider plays tracks via a hidden YouTube iframe. It's the universal
// fallback for public visitors (no homelab). Resolution turns a track into a
// videoId via a configured endpoint; playback + progress + seek go through the
// engine. No checkAvailability on purpose — a background prescan would burn
// YouTube Data API quota; resolution happens lazily on play.
export class YouTubeProvider implements AudioProvider {
  name = 'youtube';

  private readonly cfg: YouTubeConfig;
  private readonly engine: YouTubeEngine;
  private stateCallback: (state: ProviderState) => void = () => {};
  private progressCallback: (positionMs: number, durationMs: number) => void = () => {};
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as YouTubeConfig;
    this.engine = this.cfg.engine ?? new YtIframeEngine();
    this.engine.onState((yt) => this.handleYtState(yt));
  }

  // Mount the visible player into a host element (called before initialize()).
  attach(element: HTMLElement): void {
    this.engine.attach(element);
  }

  async initialize(): Promise<void> {
    await this.engine.ready();
    this.stateCallback('ready');
  }

  async load(track: Track): Promise<void> {
    let videoId: string | null;
    try {
      videoId = await this.resolve(track);
    } catch (err) {
      this.log('resolve error', track.artist, '-', track.title, err);
      this.stateCallback('error');
      return;
    }
    if (!videoId) {
      this.log('no match', track.artist, '-', track.title);
      this.stateCallback('unavailable');
      return;
    }
    this.log('resolved', track.artist, '-', track.title, '->', videoId);
    this.engine.cue(videoId); // engine emits CUED -> 'ready'
  }

  async play(): Promise<void> {
    this.engine.play();
  }

  pause(): void {
    this.engine.pause();
  }

  seek(positionMs: number): void {
    this.engine.seek(positionMs);
  }

  onStateChange(callback: (state: ProviderState) => void): void {
    this.stateCallback = callback;
  }

  onProgress(callback: (positionMs: number, durationMs: number) => void): void {
    this.progressCallback = callback;
  }

  dispose(): void {
    this.stopTicker();
    this.engine.destroy();
  }

  // resolve turns "{artist} {title} audio" into a videoId, or null when the
  // server responds but has no match. Transient failures throw.
  async resolve(track: Track): Promise<string | null> {
    const query = `${track.artist} ${track.title} audio`.trim();
    if (this.cfg.apiKey) {
      const url =
        'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1' +
        `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(this.cfg.apiKey)}`;
      const data = await this.fetchJson(url);
      return data?.items?.[0]?.id?.videoId ?? null;
    }
    if (this.cfg.searchEndpoint) {
      const sep = this.cfg.searchEndpoint.includes('?') ? '&' : '?';
      const url = `${this.cfg.searchEndpoint}${sep}q=${encodeURIComponent(query)}`;
      const data = await this.fetchJson(url);
      // Tolerate a simple { videoId } contract or a Data-API-shaped response.
      return data?.videoId ?? data?.items?.[0]?.id?.videoId ?? null;
    }
    throw new Error('YouTubeProvider: configure a searchEndpoint or apiKey');
  }

  private async fetchJson(url: string): Promise<any> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  private handleYtState(yt: number): void {
    const state = mapYtState(yt);
    if (state) this.stateCallback(state);
    if (yt === YT_PLAYING) this.startTicker();
    else this.stopTicker();
  }

  private startTicker(): void {
    this.stopTicker();
    this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs());
    this.ticker = setInterval(() => {
      this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs());
    }, PROGRESS_TICK_MS);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private log(...args: unknown[]): void {
    if (this.cfg.debug) console.debug('[byom-player:youtube]', ...args);
  }
}

// --- real iframe engine (browser only; not unit-tested) ---

let apiReady: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (apiReady) return apiReady;
  apiReady = new Promise<void>((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiReady;
}

class YtIframeEngine implements YouTubeEngine {
  private player: any = null;
  private hiddenContainer: HTMLDivElement | null = null;
  private target: HTMLElement | null = null;
  private stateCallback: (ytState: number) => void = () => {};

  attach(element: HTMLElement): void {
    this.target = element;
  }

  async ready(): Promise<void> {
    await loadYouTubeApi();
    if (this.player) return;

    // YT.Player replaces the element it's given with an iframe, so give it a
    // throwaway child (keeps the host-supplied / Lit-managed element intact).
    const holder = document.createElement('div');
    const visible = !!this.target;
    if (this.target) {
      holder.style.cssText = 'width:100%;height:100%;';
      this.target.appendChild(holder);
    } else {
      this.hiddenContainer = document.createElement('div');
      this.hiddenContainer.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(this.hiddenContainer);
      this.hiddenContainer.appendChild(holder);
    }

    await new Promise<void>((resolve) => {
      this.player = new window.YT.Player(holder, {
        width: visible ? '100%' : '1',
        height: visible ? '100%' : '1',
        events: {
          onReady: () => resolve(),
          onStateChange: (e: { data: number }) => this.stateCallback(e.data),
        },
      });
    });
  }

  cue(videoId: string): void {
    this.player?.cueVideoById(videoId);
  }
  play(): void {
    this.player?.playVideo();
  }
  pause(): void {
    this.player?.pauseVideo();
  }
  seek(positionMs: number): void {
    this.player?.seekTo(positionMs / 1000, true);
  }
  currentTimeMs(): number {
    return (this.player?.getCurrentTime?.() ?? 0) * 1000;
  }
  durationMs(): number {
    return (this.player?.getDuration?.() ?? 0) * 1000;
  }
  onState(callback: (ytState: number) => void): void {
    this.stateCallback = callback;
  }
  destroy(): void {
    this.player?.destroy?.();
    this.hiddenContainer?.remove();
  }
}
