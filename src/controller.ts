import type { Track } from './types';
import type { AudioProvider, ProviderState } from './providers/types';

export interface ControllerOptions {
  // Delay (ms) between auto-skips, to avoid hammering the source. Default 0.
  skipDelayMs?: number;
  // Consecutive transient errors that trip the circuit breaker (halt auto-skip).
  // Clean misses ('unavailable') do NOT count toward this. Default 3.
  errorLimit?: number;
  debug?: boolean;
}

// PlaybackController owns the queue and reacts to provider state. It advances
// when a track ends, skips freely past tracks the source doesn't have
// ('unavailable'), and — crucially — trips a circuit breaker after a run of
// transient errors so a flaky/rate-limiting source isn't hammered by a cascade
// of doomed skips.
export class PlaybackController {
  index = 0;
  state: ProviderState = 'uninitialized';
  halted = false;
  readonly failed = new Set<number>();

  private loadedIndex: number | null = null;
  private consecutiveErrors = 0;
  private readonly skipDelayMs: number;
  private readonly errorLimit: number;
  private readonly debug: boolean;

  constructor(
    private readonly provider: AudioProvider,
    private readonly tracks: Track[],
    private readonly onChange: () => void = () => {},
    opts: ControllerOptions = {},
  ) {
    this.skipDelayMs = opts.skipDelayMs ?? 0;
    this.errorLimit = opts.errorLimit ?? 3;
    this.debug = opts.debug ?? false;
    this.provider.onStateChange((s) => this.handle(s));
  }

  // --- user-initiated actions (reset the circuit breaker) ---

  async start(index = 0): Promise<void> {
    this.resetBreaker();
    await this.load(index);
  }

  async play(): Promise<void> {
    this.resetBreaker();
    if (this.loadedIndex !== this.index) await this.load(this.index);
    else await this.provider.play();
  }

  pause(): void {
    this.provider.pause();
  }

  async next(): Promise<void> {
    this.resetBreaker();
    await this.advance();
  }

  async prev(): Promise<void> {
    this.resetBreaker();
    if (this.index > 0) await this.load(this.index - 1);
  }

  dispose(): void {
    this.provider.dispose();
  }

  // --- internals ---

  private resetBreaker(): void {
    this.consecutiveErrors = 0;
    this.halted = false;
  }

  private async load(index: number): Promise<void> {
    if (index < 0 || index >= this.tracks.length) return;
    this.index = index;
    await this.provider.load(this.tracks[index]);
    this.loadedIndex = index;
    await this.provider.play();
  }

  private async advance(): Promise<void> {
    if (this.index < this.tracks.length - 1) await this.load(this.index + 1);
  }

  private scheduleAutoSkip(delay: number): void {
    if (delay > 0) setTimeout(() => void this.advance(), delay);
    else void this.advance();
  }

  private handle(state: ProviderState): void {
    this.state = state;
    switch (state) {
      case 'ready':
      case 'playing':
        // Success clears any stale unavailable mark and resets the breaker.
        this.failed.delete(this.index);
        this.consecutiveErrors = 0;
        break;
      case 'ended':
        void this.advance();
        break;
      case 'unavailable':
        // Clean miss — skip freely (does NOT count toward the breaker).
        this.failed.add(this.index);
        this.scheduleAutoSkip(this.skipDelayMs);
        break;
      case 'error':
        this.failed.add(this.index);
        this.consecutiveErrors += 1;
        if (this.consecutiveErrors >= this.errorLimit) {
          this.halted = true;
          this.log(`circuit breaker: halted after ${this.consecutiveErrors} consecutive errors`);
        } else {
          // Back off progressively before the next attempt.
          this.scheduleAutoSkip(this.skipDelayMs * this.consecutiveErrors);
        }
        break;
    }
    this.onChange();
  }

  private log(...args: unknown[]): void {
    if (this.debug) console.debug('[byom-player:controller]', ...args);
  }
}
