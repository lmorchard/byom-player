import type { Track } from '../types';
import type { AudioProvider, ProviderState } from './types';

const PROGRESS_TICK_MS = 250;

// MockProvider drives the playback state machine on a timer without any audio
// infrastructure. It powers UI development and tests: play() transitions to
// 'playing' and, after a configurable duration, to 'ended', emitting progress
// along the way.
export class MockProvider implements AudioProvider {
  name = 'mock';

  private callback: (state: ProviderState) => void = () => {};
  private progressCallback: (positionMs: number, durationMs: number) => void = () => {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private positionMs = 0;
  private readonly durationMs: number;

  constructor(opts: { trackDurationMs?: number } = {}) {
    this.durationMs = opts.trackDurationMs ?? 3000;
  }

  async initialize(): Promise<void> {
    this.emit('ready');
  }

  async load(_track: Track): Promise<void> {
    this.stop();
    this.positionMs = 0;
    this.emit('ready');
  }

  async play(): Promise<void> {
    this.stop();
    this.emit('playing');
    this.progressCallback(this.positionMs, this.durationMs);
    this.ticker = setInterval(() => {
      this.positionMs = Math.min(this.positionMs + PROGRESS_TICK_MS, this.durationMs);
      this.progressCallback(this.positionMs, this.durationMs);
    }, PROGRESS_TICK_MS);
    this.timer = setTimeout(() => {
      this.stop();
      this.emit('ended');
    }, this.durationMs);
  }

  pause(): void {
    this.stop();
    this.emit('paused');
  }

  seek(positionMs: number): void {
    this.positionMs = Math.max(0, Math.min(positionMs, this.durationMs));
    this.progressCallback(this.positionMs, this.durationMs);
  }

  dispose(): void {
    this.stop();
  }

  onStateChange(callback: (state: ProviderState) => void): void {
    this.callback = callback;
  }

  onProgress(callback: (positionMs: number, durationMs: number) => void): void {
    this.progressCallback = callback;
  }

  private emit(state: ProviderState): void {
    this.callback(state);
  }

  private stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
