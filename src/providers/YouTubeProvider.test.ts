import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { YouTubeProvider, mapYtState, type YouTubeEngine } from './YouTubeProvider';
import type { ProviderState } from './types';

class FakeEngine implements YouTubeEngine {
  attached: HTMLElement | null = null;
  cued: string | null = null;
  played = 0;
  paused = 0;
  seekedMs: number | null = null;
  destroyed = false;
  posMs = 0;
  durMs = 0;
  private stateCb: (n: number) => void = () => {};

  async ready(): Promise<void> {}
  attach(el: HTMLElement): void {
    this.attached = el;
  }
  cue(v: string): void {
    this.cued = v;
  }
  play(): void {
    this.played += 1;
  }
  pause(): void {
    this.paused += 1;
  }
  seek(ms: number): void {
    this.seekedMs = ms;
  }
  currentTimeMs(): number {
    return this.posMs;
  }
  durationMs(): number {
    return this.durMs;
  }
  onState(cb: (n: number) => void): void {
    this.stateCb = cb;
  }
  destroy(): void {
    this.destroyed = true;
  }
  emit(n: number): void {
    this.stateCb(n);
  }
}

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

afterEach(() => vi.restoreAllMocks());

describe('mapYtState', () => {
  it('maps YouTube state codes', () => {
    expect(mapYtState(0)).toBe('ended');
    expect(mapYtState(1)).toBe('playing');
    expect(mapYtState(2)).toBe('paused');
    expect(mapYtState(5)).toBe('ready');
    expect(mapYtState(-1)).toBe('ready');
    expect(mapYtState(3)).toBeNull(); // buffering → emit nothing
  });
});

describe('YouTubeProvider resolution', () => {
  it('resolves via a search endpoint ({videoId} contract)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okJson({ videoId: 'abc123' }));
    const p = new YouTubeProvider({
      engine: new FakeEngine(),
      searchEndpoint: 'https://s.example/yt',
    });
    expect(await p.resolve({ title: 'Nightcall', artist: 'Kavinsky' })).toBe('abc123');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('q')).toBe('Kavinsky Nightcall audio');
  });

  it('resolves via the YouTube Data API (apiKey)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ items: [{ id: { videoId: 'xyz789' } }] }),
    );
    const p = new YouTubeProvider({ engine: new FakeEngine(), apiKey: 'KEY' });
    expect(await p.resolve({ title: 'T', artist: 'A' })).toBe('xyz789');
  });

  it('returns null when there is no match', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ items: [] }));
    const p = new YouTubeProvider({ engine: new FakeEngine(), apiKey: 'KEY' });
    expect(await p.resolve({ title: 'T', artist: 'A' })).toBeNull();
  });

  it('throws when neither searchEndpoint nor apiKey is configured', async () => {
    const p = new YouTubeProvider({ engine: new FakeEngine() });
    await expect(p.resolve({ title: 'T', artist: 'A' })).rejects.toThrow();
  });

  it('load emits unavailable on no match, error on transient failure', async () => {
    const engine = new FakeEngine();
    const states: ProviderState[] = [];
    const p = new YouTubeProvider({ engine, apiKey: 'KEY' });
    p.onStateChange((s) => states.push(s));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ items: [] }));
    await p.load({ title: 'X', artist: 'Y' });
    expect(states.at(-1)).toBe('unavailable');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    await p.load({ title: 'X', artist: 'Y' });
    expect(states.at(-1)).toBe('error');
  });
});

describe('YouTubeProvider lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('drives cue/play/seek/progress/state through the engine', async () => {
    const engine = new FakeEngine();
    const states: ProviderState[] = [];
    const progress: [number, number][] = [];
    const p = new YouTubeProvider({ engine, searchEndpoint: 'https://s.example' });
    p.onStateChange((s) => states.push(s));
    p.onProgress((pos, dur) => progress.push([pos, dur]));

    await p.initialize();
    expect(states.at(-1)).toBe('ready');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ videoId: 'vid1' }));
    await p.load({ title: 'T', artist: 'A' });
    expect(engine.cued).toBe('vid1');
    engine.emit(5); // CUED
    expect(states.at(-1)).toBe('ready');

    await p.play();
    expect(engine.played).toBe(1);
    engine.posMs = 4000;
    engine.durMs = 200000;
    engine.emit(1); // PLAYING → ticker starts
    expect(states.at(-1)).toBe('playing');
    vi.advanceTimersByTime(250);
    expect(progress.at(-1)).toEqual([4000, 200000]);

    p.seek(30000);
    expect(engine.seekedMs).toBe(30000);

    engine.emit(0); // ENDED
    expect(states.at(-1)).toBe('ended');

    p.dispose();
    expect(engine.destroyed).toBe(true);
  });
});
