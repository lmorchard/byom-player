import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PlaybackController } from './controller';
import type { AudioProvider, ProviderState } from './providers/types';
import type { Track } from './types';

class FakeProvider implements AudioProvider {
  name = 'fake';
  loaded: Track[] = [];
  playCount = 0;
  pausedCount = 0;
  disposed = false;
  private cb: (s: ProviderState) => void = () => {};

  async initialize(): Promise<void> {}
  async load(t: Track): Promise<void> {
    this.loaded.push(t);
  }
  async play(): Promise<void> {
    this.playCount++;
  }
  pause(): void {
    this.pausedCount++;
  }
  seek(): void {}
  onStateChange(cb: (s: ProviderState) => void): void {
    this.cb = cb;
  }
  dispose(): void {
    this.disposed = true;
  }
  emit(s: ProviderState): void {
    this.cb(s);
  }
}

const tracks: Track[] = [
  { title: 'A', artist: 'a' },
  { title: 'B', artist: 'b' },
  { title: 'C', artist: 'c' },
];

const flush = () => new Promise((r) => setTimeout(r));

describe('PlaybackController', () => {
  let p: FakeProvider;
  let c: PlaybackController;
  let changes: number;

  beforeEach(() => {
    p = new FakeProvider();
    changes = 0;
    c = new PlaybackController(p, tracks, () => {
      changes++;
    });
  });

  it('start loads and plays the given track', async () => {
    await c.start(0);
    expect(c.index).toBe(0);
    expect(p.loaded).toEqual([tracks[0]]);
    expect(p.playCount).toBe(1);
  });

  it('advances to the next track on ended', async () => {
    await c.start(0);
    p.emit('ended');
    expect(c.index).toBe(1);
    await flush();
    expect(p.loaded).toEqual([tracks[0], tracks[1]]);
    expect(p.playCount).toBe(2);
  });

  it('stops at the last track (no overrun)', async () => {
    await c.start(2);
    p.emit('ended');
    await flush();
    expect(c.index).toBe(2);
    expect(p.loaded).toEqual([tracks[2]]);
  });

  it('records the failure and skips to the next track on error', async () => {
    await c.start(0);
    p.emit('error');
    expect(c.failed.has(0)).toBe(true);
    expect(c.index).toBe(1);
    await flush();
    expect(p.loaded).toEqual([tracks[0], tracks[1]]);
  });

  it('prev goes back but not below zero', async () => {
    await c.start(1);
    await c.prev();
    expect(c.index).toBe(0);
    await c.prev();
    expect(c.index).toBe(0);
  });

  it('play() loads and plays the current track when nothing is loaded yet', async () => {
    await c.play(); // no prior start()
    expect(c.index).toBe(0);
    expect(p.loaded).toEqual([tracks[0]]);
    expect(p.playCount).toBe(1);
  });

  it('play() resumes without reloading when the current track is already loaded', async () => {
    await c.start(0);
    expect(p.loaded).toEqual([tracks[0]]);
    await c.play();
    expect(p.loaded).toEqual([tracks[0]]); // not reloaded
    expect(p.playCount).toBe(2); // resumed
  });

  it('pause delegates to the provider', async () => {
    await c.start(0);
    c.pause();
    expect(p.pausedCount).toBe(1);
  });

  it('dispose releases the provider', () => {
    c.dispose();
    expect(p.disposed).toBe(true);
  });

  it('clears a stale unavailable mark when a failed track later plays', async () => {
    await c.start(0);
    p.emit('error'); // index 0 fails, skips to 1
    expect(c.failed.has(0)).toBe(true);
    await c.start(0); // retry track 0
    p.emit('playing'); // now it plays
    expect(c.failed.has(0)).toBe(false);
  });

  it('notifies onChange when provider state changes', async () => {
    await c.start(0);
    p.emit('playing');
    expect(changes).toBeGreaterThan(0);
  });
});

describe('PlaybackController skip throttling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delays auto-skip on error by skipDelayMs', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, tracks, () => {}, { skipDelayMs: 500 });
    await c.start(0);
    p.emit('error');
    expect(c.index).toBe(0); // not advanced yet
    vi.advanceTimersByTime(500);
    expect(c.index).toBe(1); // advanced after the delay
  });
});

describe('PlaybackController shuffle', () => {
  const five = [tracks[0], tracks[1], tracks[2], tracks[0], tracks[1]];

  it('keeps the current track, then plays the rest in shuffled order (each once)', async () => {
    const p = new FakeProvider();
    // deterministic RNG so the shuffle is stable in the test
    const seq = [0.1, 0.7, 0.3, 0.9, 0.5];
    let k = 0;
    const c = new PlaybackController(p, five, () => {}, { random: () => seq[k++ % seq.length] });
    await c.start(2);
    c.setShuffle(true);
    expect(c.shuffle).toBe(true);
    expect(c.index).toBe(2); // current track preserved as first

    const seen = [c.index];
    for (let n = 0; n < 4; n++) {
      await c.next();
      seen.push(c.index);
    }
    expect(seen[0]).toBe(2);
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]); // every track once
  });

  it('restores sequential order when shuffle is turned off', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, five, () => {}, { random: () => 0.5 });
    await c.start(3);
    c.setShuffle(true);
    c.setShuffle(false);
    expect(c.shuffle).toBe(false);
    expect(c.index).toBe(3); // still on the same track
    await c.next();
    expect(c.index).toBe(4); // sequential again
  });
});

describe('PlaybackController availability skipping', () => {
  it('skips tracks marked unavailable when advancing', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, tracks, () => {});
    c.markUnavailable(1);
    await c.start(0);
    await c.next();
    expect(c.index).toBe(2); // skipped 1
  });

  it('skips unavailable tracks going backward too', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, tracks, () => {});
    c.markUnavailable(1);
    await c.start(2);
    await c.prev();
    expect(c.index).toBe(0); // skipped 1
  });

  it('still plays an unavailable track on an explicit start (manual override)', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, tracks, () => {});
    c.markUnavailable(1);
    await c.start(1);
    expect(c.index).toBe(1);
    expect(p.loaded).toEqual([tracks[1]]);
  });

  it('clears the skip-mark once a track actually plays', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, tracks, () => {});
    c.markUnavailable(1);
    await c.start(1);
    p.emit('playing'); // it plays after all
    await c.start(0);
    await c.next();
    expect(c.index).toBe(1); // no longer skipped
  });
});

describe('PlaybackController error handling', () => {
  const long = [tracks[0], tracks[1], tracks[2], tracks[0], tracks[1]];

  it('trips the circuit breaker after N consecutive errors and stops advancing', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, long, () => {}, { errorLimit: 2 });
    await c.start(0);
    p.emit('error'); // 1st error < limit → skip to 1
    expect(c.halted).toBe(false);
    expect(c.index).toBe(1);
    p.emit('error'); // 2nd consecutive → halt, do NOT advance
    expect(c.halted).toBe(true);
    expect(c.index).toBe(1);
  });

  it('skips unavailable tracks freely without tripping the breaker', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, long, () => {}, { errorLimit: 2 });
    await c.start(0);
    p.emit('unavailable'); // 0 → 1
    p.emit('unavailable'); // 1 → 2
    p.emit('unavailable'); // 2 → 3
    expect(c.halted).toBe(false);
    expect(c.index).toBe(3);
    expect([...c.failed].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('resets the breaker after a successful play', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, long, () => {}, { errorLimit: 2 });
    await c.start(0);
    p.emit('error'); // consecutive = 1 → skip to 1
    p.emit('playing'); // success resets the counter
    p.emit('error'); // consecutive = 1 again, not 2 → no halt
    expect(c.halted).toBe(false);
  });

  it('a user action (next) resets a tripped breaker', async () => {
    const p = new FakeProvider();
    const c = new PlaybackController(p, long, () => {}, { errorLimit: 1 });
    await c.start(0);
    p.emit('error'); // errorLimit 1 → halt immediately
    expect(c.halted).toBe(true);
    await c.next(); // user intent clears the breaker
    expect(c.halted).toBe(false);
  });
});
