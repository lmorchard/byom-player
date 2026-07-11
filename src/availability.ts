import type { Track } from './types';
import type { AudioProvider, AvailabilityStatus } from './providers/types';

export interface AvailabilityQueueOptions {
  // Cooldown (ms) between uncached checks. Cache hits skip it. Default 300.
  delayMs?: number;
}

// AvailabilityQueue checks the availability of requested tracks gently — one at
// a time, with a cooldown between uncached checks. Checked results persist for
// the session (a checked index is never re-checked), but a queued-but-unstarted
// index can be dropped via retain() so the caller can keep the queue focused on
// what's currently relevant (the visible window) rather than a long tail of
// scrolled-past rows. It is a no-op for providers that can't check availability.
export class AvailabilityQueue {
  private readonly check?: (t: Track) => Promise<AvailabilityStatus>;
  private readonly isCached?: (t: Track) => boolean;
  private readonly delayMs: number;
  private readonly pending: number[] = []; // FIFO of indices awaiting a check
  private readonly queued = new Set<number>(); // membership of `pending` (dedup)
  private readonly done = new Set<number>(); // checked → reported (persist, never re-check)
  private inFlight: number | null = null; // the index currently being checked
  private draining = false;
  private disposed = false;

  constructor(
    provider: AudioProvider,
    private readonly tracks: Track[],
    private readonly onResult: (index: number, status: AvailabilityStatus) => void,
    opts: AvailabilityQueueOptions = {},
  ) {
    this.check = provider.checkAvailability?.bind(provider);
    this.isCached = provider.isResolutionCached?.bind(provider);
    this.delayMs = opts.delayMs ?? 300;
  }

  request(indices: Iterable<number>): number[] {
    if (!this.check || this.disposed) return [];
    const accepted: number[] = [];
    for (const i of indices) {
      if (i < 0 || i >= this.tracks.length) continue;
      if (this.done.has(i) || this.queued.has(i) || i === this.inFlight) continue;
      this.queued.add(i);
      this.pending.push(i);
      accepted.push(i);
    }
    if (accepted.length) void this.drain();
    return accepted;
  }

  // Drop every queued-but-unstarted index that isn't in `keep`, returning the
  // dropped indices. Checked (`done`) indices and the one in-flight check are
  // untouched — the in-flight check finishes and caches its result. Dropped
  // indices become eligible again on a later request() (they were never checked).
  retain(keep: Set<number>): number[] {
    const dropped: number[] = [];
    for (let n = this.pending.length - 1; n >= 0; n--) {
      const i = this.pending[n];
      if (!keep.has(i)) {
        this.pending.splice(n, 1);
        this.queued.delete(i);
        dropped.push(i);
      }
    }
    return dropped;
  }

  dispose(): void {
    this.disposed = true;
    this.pending.length = 0;
    this.queued.clear();
  }

  private async drain(): Promise<void> {
    if (this.draining || !this.check) return;
    this.draining = true;
    try {
      while (this.pending.length && !this.disposed) {
        const i = this.pending.shift()!;
        this.queued.delete(i);
        this.inFlight = i;
        const cached = this.isCached?.(this.tracks[i]) ?? false;
        let status: AvailabilityStatus;
        try {
          status = await this.check(this.tracks[i]);
        } catch {
          status = 'unknown';
        }
        this.inFlight = null;
        if (this.disposed) return;
        this.done.add(i);
        this.onResult(i, status);
        if (this.delayMs > 0 && !cached && this.pending.length) {
          await new Promise((r) => setTimeout(r, this.delayMs));
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
