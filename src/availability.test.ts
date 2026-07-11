import { describe, it, expect, vi } from 'vitest';
import { AvailabilityQueue } from './availability';
import type { AudioProvider, AvailabilityStatus } from './providers/types';
import type { Track } from './types';

function providerWith(check?: (t: Track) => Promise<AvailabilityStatus>): AudioProvider {
  return {
    name: 't',
    initialize: async () => {},
    load: async () => {},
    play: async () => {},
    pause() {},
    seek() {},
    onStateChange() {},
    dispose() {},
    checkAvailability: check,
  };
}

const tracks: Track[] = [
  { title: 'a', artist: 'a' },
  { title: 'b', artist: 'b' },
  { title: 'c', artist: 'c' },
];

// small helper to await the queue draining when delayMs is 0
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('AvailabilityQueue', () => {
  it('checks requested indices and reports each result once', async () => {
    const p = providerWith(async (t) => (t.title === 'b' ? 'unavailable' : 'available'));
    const results: [number, AvailabilityStatus][] = [];
    const q = new AvailabilityQueue(p, tracks, (i, s) => results.push([i, s]), { delayMs: 0 });
    q.request([0, 1, 2]);
    await tick();
    expect(results).toEqual([
      [0, 'available'],
      [1, 'unavailable'],
      [2, 'available'],
    ]);
  });

  it('is a no-op when the provider cannot check', async () => {
    const q = new AvailabilityQueue(providerWith(undefined), tracks, () => {}, { delayMs: 0 });
    expect(q.request([0, 1, 2])).toEqual([]);
  });

  it('de-dupes: an index already checked or queued is not re-accepted', async () => {
    const p = providerWith(async () => 'available');
    const q = new AvailabilityQueue(p, tracks, () => {}, { delayMs: 0 });
    expect(q.request([0, 1])).toEqual([0, 1]);
    expect(q.request([1, 2])).toEqual([2]); // 1 already seen
    await tick();
    expect(q.request([0, 1, 2])).toEqual([]); // all checked
  });

  it('ignores out-of-range indices', async () => {
    const p = providerWith(async () => 'available');
    const q = new AvailabilityQueue(p, tracks, () => {}, { delayMs: 0 });
    expect(q.request([-1, 5, 1])).toEqual([1]);
  });

  it('reports unknown when a check throws', async () => {
    const p = providerWith(async () => {
      throw new Error('boom');
    });
    const results: AvailabilityStatus[] = [];
    const q = new AvailabilityQueue(p, tracks, (_i, s) => results.push(s), { delayMs: 0 });
    q.request([0, 1, 2]);
    await tick();
    expect(results).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('skips the inter-check delay for cached tracks', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const p = providerWith(async () => 'available');
    p.isResolutionCached = () => true;
    const q = new AvailabilityQueue(p, tracks, () => {}, { delayMs: 50 });
    q.request([0, 1, 2]);
    await tick();
    expect(timeoutSpy.mock.calls.filter((c) => c[1] === 50)).toHaveLength(0);
    timeoutSpy.mockRestore();
  });

  it('delays between uncached checks (but not after the last)', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const p = providerWith(async () => 'available');
    const q = new AvailabilityQueue(p, tracks, () => {}, { delayMs: 40 });
    q.request([0, 1, 2]);
    // Use a distinct wait delay (45ms) for our own synchronization so it doesn't
    // collide with the queue's 40ms cooldown timers in the assertion below.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 45));
    await new Promise((r) => setTimeout(r, 45));
    expect(timeoutSpy.mock.calls.filter((c) => c[1] === 40)).toHaveLength(tracks.length - 1);
    timeoutSpy.mockRestore();
  });

  it('stops draining after dispose', async () => {
    let calls = 0;
    const q = new AvailabilityQueue(
      providerWith(async () => {
        calls += 1;
        return 'available';
      }),
      tracks,
      () => {},
      { delayMs: 0 },
    );
    q.request([0, 1, 2]);
    q.dispose();
    await tick();
    expect(calls).toBeLessThanOrEqual(1); // at most the in-flight check
    expect(q.request([0, 1, 2])).toEqual([]); // ignores further requests
  });
});
