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
/** Cooldown between uncached checks against a public catalogue with a quota. */
export const PUBLIC_GAP_MS = 300;
/** Cooldown against a collection you own — no quota to burn. */
export const COLLECTION_GAP_MS = 50;

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
  private sweeping = false; // a full sweep is in flight; retain() must not prune it

  constructor(
    provider: AudioProvider,
    private readonly tracks: Track[],
    private readonly onResult: (index: number, status: AvailabilityStatus) => void,
    opts: AvailabilityQueueOptions = {},
  ) {
    this.check = provider.checkAvailability?.bind(provider);
    this.isCached = provider.isResolutionCached?.bind(provider);
    // A collection server is yours: no third-party quota to be polite about, so
    // a full sweep can run an order of magnitude faster. On a ~8.6k-track
    // playlist that is the difference between ~43 minutes and ~7. An explicit
    // delayMs from the host still wins.
    this.delayMs = opts.delayMs ?? (provider.isCollection ? COLLECTION_GAP_MS : PUBLIC_GAP_MS);
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
  // requestAll queues every track, for an explicit full sweep. Unlike the
  // viewport-driven path this is never pruned by retain(), because the caller
  // wants the whole playlist checked rather than just what is on screen.
  //
  // Only ever called in response to a deliberate user action — a sweep is
  // expensive and must not start on its own.
  requestAll(): number[] {
    this.sweeping = true;
    return this.request(this.tracks.map((_, i) => i));
  }

  // Stop adding work without discarding what has already been checked, so
  // closing the panel mid-sweep costs nothing and re-summoning resumes.
  stopSweep(): void {
    this.sweeping = false;
    this.pending.length = 0;
    this.queued.clear();
  }

  // How many tracks have a settled result. The panel shows this as progress;
  // it counts checks, not links, so it rises even when everything is present.
  get checkedCount(): number {
    return this.done.size;
  }

  // True once every track has a result, so the panel can stop saying "scanning".
  get complete(): boolean {
    return this.done.size >= this.tracks.length;
  }

  retain(keep: Set<number>): number[] {
    if (this.sweeping) return []; // a full sweep outranks the visible window
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
