import type { Track } from './types';
import type { AudioProvider, AvailabilityStatus } from './providers/types';

export interface AvailabilityQueueOptions {
  // Cooldown (ms) between uncached checks. Cache hits skip it. Default 300.
  delayMs?: number;
}

// AvailabilityQueue checks the availability of requested tracks gently — one at
// a time, with a cooldown between uncached checks — and de-dupes so each index
// is checked at most once for the queue's lifetime. Results therefore persist
// for the session: request() ignores indices already checked or queued. It is a
// no-op for providers that can't check availability.
export class AvailabilityQueue {
  private readonly check?: (t: Track) => Promise<AvailabilityStatus>;
  private readonly isCached?: (t: Track) => boolean;
  private readonly delayMs: number;
  private readonly pending: number[] = []; // FIFO of indices awaiting a check
  private readonly seen = new Set<number>(); // queued-or-done (dedup)
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
      if (i < 0 || i >= this.tracks.length || this.seen.has(i)) continue;
      this.seen.add(i);
      this.pending.push(i);
      accepted.push(i);
    }
    if (accepted.length) void this.drain();
    return accepted;
  }

  dispose(): void {
    this.disposed = true;
    this.pending.length = 0;
  }

  private async drain(): Promise<void> {
    if (this.draining || !this.check) return;
    this.draining = true;
    try {
      while (this.pending.length && !this.disposed) {
        const i = this.pending.shift()!;
        const cached = this.isCached?.(this.tracks[i]) ?? false;
        let status: AvailabilityStatus;
        try {
          status = await this.check(this.tracks[i]);
        } catch {
          status = 'unknown';
        }
        if (this.disposed) return;
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
