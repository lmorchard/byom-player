import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockProvider } from './MockProvider';
import type { ProviderState } from './types';
import type { Track } from '../types';

const track: Track = { title: 'X', artist: 'y' };

describe('MockProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits ready on initialize and load', async () => {
    const states: ProviderState[] = [];
    const p = new MockProvider({ trackDurationMs: 1000 });
    p.onStateChange((s) => states.push(s));
    await p.initialize();
    await p.load(track);
    expect(states).toEqual(['ready', 'ready']);
  });

  it('plays then ends after the track duration', async () => {
    const states: ProviderState[] = [];
    const p = new MockProvider({ trackDurationMs: 1000 });
    p.onStateChange((s) => states.push(s));
    await p.initialize();
    await p.load(track);
    await p.play();
    expect(states.at(-1)).toBe('playing');
    vi.advanceTimersByTime(1000);
    expect(states.at(-1)).toBe('ended');
  });

  it('emits progress while playing and on seek', async () => {
    const progress: [number, number][] = [];
    const p = new MockProvider({ trackDurationMs: 1000 });
    p.onProgress((pos, dur) => progress.push([pos, dur]));
    await p.initialize();
    await p.load(track);
    await p.play();
    vi.advanceTimersByTime(500);
    const last = progress.at(-1)!;
    expect(last[0]).toBeGreaterThan(0); // position advanced
    expect(last[0]).toBeLessThanOrEqual(1000);
    expect(last[1]).toBe(1000); // duration
    p.seek(250);
    expect(progress.at(-1)).toEqual([250, 1000]);
  });

  it('pause clears the timer and emits paused (no later ended)', async () => {
    const states: ProviderState[] = [];
    const p = new MockProvider({ trackDurationMs: 1000 });
    p.onStateChange((s) => states.push(s));
    await p.initialize();
    await p.load(track);
    await p.play();
    p.pause();
    expect(states.at(-1)).toBe('paused');
    vi.advanceTimersByTime(2000);
    expect(states.at(-1)).toBe('paused');
  });
});
