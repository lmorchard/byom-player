import { describe, it, expect, beforeEach } from 'vitest';
import { PlaybackController } from './controller';
import type { AudioProvider, ProviderState } from './providers/types';
import type { Track } from './types';

class FakeProvider implements AudioProvider {
  name = 'fake';
  loaded: Track[] = [];
  playCount = 0;
  pausedCount = 0;
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

  it('pause delegates to the provider', async () => {
    await c.start(0);
    c.pause();
    expect(p.pausedCount).toBe(1);
  });

  it('notifies onChange when provider state changes', async () => {
    await c.start(0);
    p.emit('playing');
    expect(changes).toBeGreaterThan(0);
  });
});
