import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { YouTubeProvider, mapYtState, type YouTubeEngine } from './YouTubeProvider';
import type { ProviderState } from './types';
import type { ResolutionCache } from './resolutionCache';

// In-memory ResolutionCache recording interactions. null = known miss.
class FakeCache implements ResolutionCache {
  store = new Map<string, string | null>();
  gets: Array<[string, string]> = [];
  sets: Array<[string, string, string]> = [];
  misses: Array<[string, string]> = [];
  private ck(s: string, k: string) {
    return s + '|' + k;
  }
  get(s: string, k: string): string | null | undefined {
    this.gets.push([s, k]);
    const ck = this.ck(s, k);
    return this.store.has(ck) ? this.store.get(ck) : undefined;
  }
  set(s: string, k: string, id: string) {
    this.sets.push([s, k, id]);
    this.store.set(this.ck(s, k), id);
  }
  setMiss(s: string, k: string) {
    this.misses.push([s, k]);
    this.store.set(this.ck(s, k), null);
  }
  evict(s: string, k: string) {
    this.store.delete(this.ck(s, k));
  }
  clear(s: string) {
    for (const key of [...this.store.keys()]) if (key.startsWith(s + '|')) this.store.delete(key);
  }
}

// Providers created without an injected cache use the real localStorage-backed
// cache; give the suite a real localStorage (CI's Node exposes one; happy-dom
// locally does not) and reset it around each test so ids don't leak.
function installLocalStorage(): void {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const m = new Map<string, string>();
  (globalThis as { localStorage: Storage }).localStorage = {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  } as Storage;
}

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

beforeEach(() => {
  installLocalStorage();
  globalThis.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage?.clear();
});

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

  it('returns null (no throw) when unconfigured and the track has no embedded/cached id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const p = new YouTubeProvider({ engine: new FakeEngine() });
    expect(await p.resolve({ title: 'T', artist: 'A' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the embedded resolved.youtube id without any search', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const p = new YouTubeProvider({ engine: new FakeEngine() }); // no key/endpoint
    const id = await p.resolve({ title: 'T', artist: 'A', resolvedIds: { youtube: 'emb123' } });
    expect(id).toBe('emb123');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a cached id without searching', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const cache = new FakeCache();
    cache.set('youtube', 'q:a|t', 'cachedVid');
    const p = new YouTubeProvider({ engine: new FakeEngine(), resolutionCache: cache });
    expect(await p.resolve({ title: 't', artist: 'a' })).toBe('cachedVid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches a live-resolved id (next resolve skips the search)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ videoId: 'live1' }));
    const cache = new FakeCache();
    const p = new YouTubeProvider({
      engine: new FakeEngine(),
      searchEndpoint: 'https://s.example',
      resolutionCache: cache,
    });
    expect(await p.resolve({ title: 't', artist: 'a' })).toBe('live1');
    expect(cache.sets).toEqual([['youtube', 'q:a|t', 'live1']]);
    expect(await p.resolve({ title: 't', artist: 'a' })).toBe('live1'); // cache hit
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('negative-caches a search miss (next resolve returns null without searching)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ items: [] }));
    const cache = new FakeCache();
    const p = new YouTubeProvider({
      engine: new FakeEngine(),
      apiKey: 'KEY',
      resolutionCache: cache,
    });
    expect(await p.resolve({ title: 't', artist: 'a' })).toBeNull();
    expect(cache.misses).toEqual([['youtube', 'q:a|t']]);
    expect(await p.resolve({ title: 't', artist: 'a' })).toBeNull(); // known miss
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not touch the cache when cache: false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ videoId: 'x' }));
    const cache = new FakeCache();
    const p = new YouTubeProvider({
      engine: new FakeEngine(),
      searchEndpoint: 'https://s.example',
      cache: false,
      resolutionCache: cache,
    });
    await p.resolve({ title: 't', artist: 'a' });
    expect(cache.gets).toHaveLength(0);
    expect(cache.sets).toHaveLength(0);
  });

  it('checkAvailability: embedded/cache -> available; known-miss -> unavailable; unknown without search', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const cache = new FakeCache();
    cache.set('youtube', 'q:a|cached', 'vid');
    cache.setMiss('youtube', 'q:a|miss');
    const p = new YouTubeProvider({ engine: new FakeEngine(), resolutionCache: cache });

    expect(
      await p.checkAvailability({ title: 'emb', artist: 'a', resolvedIds: { youtube: 'e' } }),
    ).toBe('available');
    expect(await p.checkAvailability({ title: 'cached', artist: 'a' })).toBe('available');
    expect(await p.checkAvailability({ title: 'miss', artist: 'a' })).toBe('unavailable');
    expect(await p.checkAvailability({ title: 'unknown', artist: 'a' })).toBe('unknown'); // no key
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checkAvailability searches when a key is set (available/unavailable/unknown)', async () => {
    const cache = new FakeCache();
    const p = new YouTubeProvider({
      engine: new FakeEngine(),
      apiKey: 'KEY',
      resolutionCache: cache,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ items: [{ id: { videoId: 'v' } }] }));
    expect(await p.checkAvailability({ title: 'hit', artist: 'a' })).toBe('available');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ items: [] }));
    expect(await p.checkAvailability({ title: 'nomatch', artist: 'a' })).toBe('unavailable');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    expect(await p.checkAvailability({ title: 'flaky', artist: 'a' })).toBe('unknown');
  });

  it('isResolutionCached is true for embedded or cached, false otherwise', () => {
    const cache = new FakeCache();
    cache.set('youtube', 'q:a|cached', 'vid');
    cache.setMiss('youtube', 'q:a|miss');
    const p = new YouTubeProvider({ engine: new FakeEngine(), resolutionCache: cache });
    expect(p.isResolutionCached({ title: 'emb', artist: 'a', resolvedIds: { youtube: 'e' } })).toBe(
      true,
    );
    expect(p.isResolutionCached({ title: 'cached', artist: 'a' })).toBe(true);
    expect(p.isResolutionCached({ title: 'miss', artist: 'a' })).toBe(true); // known miss counts
    expect(p.isResolutionCached({ title: 'unknown', artist: 'a' })).toBe(false);
  });

  it('load emits unavailable on no match, error on transient failure', async () => {
    // cache: false — this re-loads the same track across changing responses to
    // check load's state mapping; negative caching is orthogonal here.
    const engine = new FakeEngine();
    const states: ProviderState[] = [];
    const p = new YouTubeProvider({ engine, apiKey: 'KEY', cache: false });
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
