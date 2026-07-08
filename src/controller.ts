import type { Track } from './types';
import type { AudioProvider, ProviderState } from './providers/types';

export interface ControllerOptions {
  // Delay (ms) between auto-skips, to avoid hammering the source. Default 0.
  skipDelayMs?: number;
  // Consecutive transient errors that trip the circuit breaker (halt auto-skip).
  // Clean misses ('unavailable') do NOT count toward this. Default 3.
  errorLimit?: number;
  debug?: boolean;
  // Injectable RNG for deterministic shuffle in tests. Default Math.random.
  random?: () => number;
}

// PlaybackController owns the play queue and reacts to provider state. It plays
// through an `order` of track indices (identity, or shuffled), advances when a
// track ends, skips freely past tracks the source doesn't have ('unavailable'),
// and trips a circuit breaker after a run of transient errors so a flaky source
// isn't hammered by a cascade of doomed skips.
export class PlaybackController {
  state: ProviderState = 'uninitialized';
  halted = false;
  shuffle = false;
  positionMs = 0;
  durationMs = 0;
  readonly failed = new Set<number>();
  // Track indices known to be unavailable (from the background prescan or a
  // playback miss). Auto-advance / next / prev skip these; an explicit start()
  // still tries them (manual override).
  private readonly unavailable = new Set<number>();

  private order: number[];
  private pos = 0;
  private loadedIndex: number | null = null;
  private consecutiveErrors = 0;
  private readonly skipDelayMs: number;
  private readonly errorLimit: number;
  private readonly debug: boolean;
  private readonly random: () => number;

  constructor(
    private readonly provider: AudioProvider,
    private readonly tracks: Track[],
    private readonly onChange: () => void = () => {},
    opts: ControllerOptions = {},
  ) {
    this.skipDelayMs = opts.skipDelayMs ?? 0;
    this.errorLimit = opts.errorLimit ?? 3;
    this.debug = opts.debug ?? false;
    this.random = opts.random ?? Math.random;
    this.order = tracks.map((_, i) => i);
    this.provider.onStateChange((s) => this.handle(s));
    this.provider.onProgress?.((pos, dur) => {
      this.positionMs = pos;
      this.durationMs = dur;
      this.onChange();
    });
  }

  // The current TRACK index (into `tracks`), for the UI's active marker.
  get index(): number {
    return this.order[this.pos] ?? 0;
  }

  // --- user-initiated actions (reset the circuit breaker) ---

  async start(trackIndex = 0): Promise<void> {
    this.resetBreaker();
    this.pos = this.posOf(trackIndex);
    await this.loadCurrent();
  }

  async play(): Promise<void> {
    this.resetBreaker();
    if (this.loadedIndex !== this.index) await this.loadCurrent();
    else await this.provider.play();
  }

  pause(): void {
    this.provider.pause();
  }

  seek(positionMs: number): void {
    this.provider.seek(positionMs);
  }

  async next(): Promise<void> {
    this.resetBreaker();
    await this.advance();
  }

  async prev(): Promise<void> {
    this.resetBreaker();
    const p = this.step(-1);
    if (p !== null) {
      this.pos = p;
      await this.loadCurrent();
    }
  }

  // markUnavailable records (or clears) foreknowledge that a track can't be
  // played, so the queue skips it. Fed by the background availability prescan.
  markUnavailable(trackIndex: number, value = true): void {
    if (value) this.unavailable.add(trackIndex);
    else this.unavailable.delete(trackIndex);
  }

  // setShuffle rebuilds the play order, keeping the current track playing.
  setShuffle(on: boolean): void {
    if (on === this.shuffle) return;
    const current = this.index;
    if (on) {
      const others = this.order.filter((i) => i !== current);
      this.order = [current, ...this.shuffled(others)];
    } else {
      this.order = this.tracks.map((_, i) => i);
    }
    this.pos = this.posOf(current);
    this.shuffle = on;
    this.onChange();
  }

  dispose(): void {
    this.provider.dispose();
  }

  // --- internals ---

  private posOf(trackIndex: number): number {
    const p = this.order.indexOf(trackIndex);
    return p >= 0 ? p : 0;
  }

  private resetBreaker(): void {
    this.consecutiveErrors = 0;
    this.halted = false;
  }

  private async loadCurrent(): Promise<void> {
    const trackIndex = this.order[this.pos];
    if (trackIndex === undefined) return;
    this.positionMs = 0;
    this.durationMs = 0;
    await this.provider.load(this.tracks[trackIndex]);
    this.loadedIndex = trackIndex;
    await this.provider.play();
  }

  private async advance(): Promise<void> {
    const p = this.step(1);
    if (p !== null) {
      this.pos = p;
      await this.loadCurrent();
    }
  }

  // step finds the next position in the given direction whose track is not
  // known-unavailable, or null if there's none.
  private step(direction: 1 | -1): number | null {
    let p = this.pos + direction;
    while (p >= 0 && p < this.order.length) {
      if (!this.unavailable.has(this.order[p])) return p;
      p += direction;
    }
    return null;
  }

  private scheduleAutoSkip(delay: number): void {
    if (delay > 0) setTimeout(() => void this.advance(), delay);
    else void this.advance();
  }

  private shuffled(input: number[]): number[] {
    const arr = input.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private handle(state: ProviderState): void {
    this.state = state;
    switch (state) {
      case 'ready':
      case 'playing':
        // Success clears any stale unavailable mark and resets the breaker.
        this.failed.delete(this.index);
        this.unavailable.delete(this.index);
        this.consecutiveErrors = 0;
        break;
      case 'ended':
        void this.advance();
        break;
      case 'unavailable':
        // Clean miss — skip freely (does NOT count toward the breaker) and
        // remember it so future advances skip it too.
        this.failed.add(this.index);
        this.unavailable.add(this.index);
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
