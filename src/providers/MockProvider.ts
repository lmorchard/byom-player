import type { Track } from '../types';
import type { AudioProvider, ProviderState } from './types';

// MockProvider drives the playback state machine on a timer without any audio
// infrastructure. It powers UI development and tests: play() transitions to
// 'playing' and, after a configurable duration, to 'ended'.
export class MockProvider implements AudioProvider {
  name = 'mock';

  private callback: (state: ProviderState) => void = () => {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly durationMs: number;

  constructor(opts: { trackDurationMs?: number } = {}) {
    this.durationMs = opts.trackDurationMs ?? 3000;
  }

  async initialize(): Promise<void> {
    this.emit('ready');
  }

  async load(_track: Track): Promise<void> {
    this.clearTimer();
    this.emit('ready');
  }

  async play(): Promise<void> {
    this.clearTimer();
    this.emit('playing');
    this.timer = setTimeout(() => this.emit('ended'), this.durationMs);
  }

  pause(): void {
    this.clearTimer();
    this.emit('paused');
  }

  seek(_positionMs: number): void {
    // no-op for the mock
  }

  dispose(): void {
    this.clearTimer();
  }

  onStateChange(callback: (state: ProviderState) => void): void {
    this.callback = callback;
  }

  private emit(state: ProviderState): void {
    this.callback(state);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
