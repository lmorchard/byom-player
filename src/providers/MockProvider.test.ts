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
