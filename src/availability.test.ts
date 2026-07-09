import { describe, it, expect, vi } from 'vitest';
import { sweepAvailability } from './availability';
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

describe('sweepAvailability', () => {
  it('reports availability for each track in order', async () => {
    const p = providerWith(async (t) => (t.title === 'b' ? 'unavailable' : 'available'));
    const results: [number, AvailabilityStatus][] = [];
    await sweepAvailability(p, tracks, (i, s) => results.push([i, s]), { delayMs: 0 });
    expect(results).toEqual([
      [0, 'available'],
      [1, 'unavailable'],
      [2, 'available'],
    ]);
  });

  it('is a no-op when the provider cannot check', async () => {
    const results: unknown[] = [];
    await sweepAvailability(providerWith(undefined), tracks, (i, s) => results.push([i, s]), {
      delayMs: 0,
    });
    expect(results).toEqual([]);
  });

  it('reports unknown when a check throws', async () => {
    const p = providerWith(async () => {
      throw new Error('boom');
    });
    const results: [number, AvailabilityStatus][] = [];
    await sweepAvailability(p, tracks, (i, s) => results.push([i, s]), { delayMs: 0 });
    expect(results.every(([, s]) => s === 'unknown')).toBe(true);
  });

  it('skips the inter-check delay for already-cached tracks', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const p = providerWith(async () => 'available');
    p.isResolutionCached = () => true; // every track is a cache hit
    await sweepAvailability(p, tracks, () => {}, { delayMs: 50 });
    // no server cooldown scheduled, since no check touched the server
    expect(timeoutSpy.mock.calls.filter((c) => c[1] === 50)).toHaveLength(0);
    timeoutSpy.mockRestore();
  });

  it('still delays between uncached checks', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const p = providerWith(async () => 'available'); // no isResolutionCached → all uncached
    await sweepAvailability(p, tracks, () => {}, { delayMs: 40 });
    expect(timeoutSpy.mock.calls.filter((c) => c[1] === 40)).toHaveLength(tracks.length - 1);
    timeoutSpy.mockRestore();
  });

  it('stops promptly when aborted', async () => {
    const ac = new AbortController();
    let calls = 0;
    const p = providerWith(async () => {
      calls += 1;
      ac.abort(); // abort during the first check
      return 'available';
    });
    const results: unknown[] = [];
    await sweepAvailability(p, tracks, (i, s) => results.push([i, s]), {
      delayMs: 0,
      signal: ac.signal,
    });
    expect(calls).toBe(1);
    expect(results).toEqual([]); // aborted before reporting
  });
});
