import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlexProvider, firstTrackPartKey } from './PlexProvider';
import type { ProviderState } from '../types';
import type { ResolutionCache } from '../resolutionCache';
import type { PlexAuthLike, PlexSession } from './types';

class FakeCache implements ResolutionCache {
  store = new Map<string, string | null>();
  sets: Array<[string, string, string]> = [];
  misses: Array<[string, string]> = [];
  private ck(s: string, k: string) {
    return s + '|' + k;
  }
  get(s: string, k: string) {
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
    for (const k of [...this.store.keys()]) if (k.startsWith(s + '|')) this.store.delete(k);
  }
}

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

// A /library/search JSON response wrapping one track with a part key.
function searchResponse(partKey: string | null) {
  const metadata = partKey
    ? [{ type: 'track', title: 'X', Media: [{ Part: [{ key: partKey }] }] }]
    : [];
  return {
    ok: true,
    json: async () => ({ MediaContainer: { size: metadata.length, Metadata: metadata } }),
  } as Response;
}

beforeEach(() => {
  installLocalStorage();
  globalThis.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage?.clear();
});

const CFG = { baseUrl: 'https://plex.example:32400', token: 'TK' };

describe('firstTrackPartKey', () => {
  it('reads a part key from MediaContainer.Metadata', () => {
    expect(
      firstTrackPartKey({
        MediaContainer: {
          Metadata: [{ type: 'track', Media: [{ Part: [{ key: '/library/parts/1/a.mp3' }] }] }],
        },
      }),
    ).toBe('/library/parts/1/a.mp3');
  });
  it('reads a part key from MediaContainer.SearchResult[].Metadata', () => {
    expect(
      firstTrackPartKey({
        MediaContainer: {
          SearchResult: [
            {
              Metadata: { type: 'track', Media: [{ Part: [{ key: '/library/parts/2/b.flac' }] }] },
            },
          ],
        },
      }),
    ).toBe('/library/parts/2/b.flac');
  });
  it('skips non-track results and returns null when none match', () => {
    expect(
      firstTrackPartKey({ MediaContainer: { Metadata: [{ type: 'album' }, { type: 'artist' }] } }),
    ).toBeNull();
    expect(firstTrackPartKey({})).toBeNull();
  });
});

describe('PlexProvider resolution', () => {
  it('builds a /library/search URL from "{artist} {title}" and returns the part key', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(searchResponse('/library/parts/9/x.mp3'));
    const p = new PlexProvider(CFG);
    const key = await p.resolve({ title: 'Nightcall', artist: 'Kavinsky' });
    expect(key).toBe('/library/parts/9/x.mp3');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/library/search');
    expect(url.searchParams.get('query')).toBe('Kavinsky Nightcall');
    expect(url.searchParams.get('searchTypes')).toBe('music');
    expect(url.searchParams.get('X-Plex-Token')).toBe('TK');
  });

  it('streamUrl joins the part key to the base with the token', () => {
    const p = new PlexProvider(CFG);
    const u = new URL(p.streamUrl('/library/parts/9/x.mp3'));
    expect(u.origin + u.pathname).toBe('https://plex.example:32400/library/parts/9/x.mp3');
    expect(u.searchParams.get('X-Plex-Token')).toBe('TK');
  });

  it('load emits unavailable on no match, error on transient failure', async () => {
    const states: ProviderState[] = [];
    // cache: false so the no-match miss isn't remembered between the two loads.
    const p = new PlexProvider({ ...CFG, retryDelayMs: 0, cache: false });
    p.onStateChange((s) => states.push(s));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse(null));
    await p.load({ title: 'X', artist: 'Y' });
    expect(states).toContain('unavailable');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    await p.load({ title: 'X', artist: 'Y' });
    expect(states).toContain('error');
  });

  it('checkAvailability: available / unavailable / unknown', async () => {
    const p = new PlexProvider({ ...CFG, retryDelayMs: 0, cache: false });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse('/p/1'));
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('available');
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse(null));
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unavailable');
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unknown');
  });

  it('checkAvailability returns unknown WITHOUT probing when there is no auth', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    // No token yet (PIN flow not linked): a base URL alone is not enough.
    const p = new PlexProvider({ baseUrl: 'https://plex.example:32400', cache: false });
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unknown');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isResolutionCached reflects cache membership (hit or known miss), gated by auth', () => {
    const cache = new FakeCache();
    cache.set('plex:https://plex.example:32400', 'q:a|t', '/p/1');
    cache.setMiss('plex:https://plex.example:32400', 'q:b|u');
    const p = new PlexProvider({ ...CFG, resolutionCache: cache });
    expect(p.isResolutionCached({ title: 't', artist: 'a' })).toBe(true); // hit
    expect(p.isResolutionCached({ title: 'u', artist: 'b' })).toBe(true); // known miss
    expect(p.isResolutionCached({ title: 'z', artist: 'z' })).toBe(false); // absent

    // Unlinked (no token): checkAvailability short-circuits to 'unknown' without
    // touching the server, so the sweep needn't throttle — always "cached".
    const unauthed = new PlexProvider({
      baseUrl: 'https://plex.example:32400',
      resolutionCache: cache,
    });
    expect(unauthed.isResolutionCached({ title: 't', artist: 'a' })).toBe(true);
  });

  it('caches a resolved part key (scoped by baseUrl)', async () => {
    const cache = new FakeCache();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse('/p/live'));
    const p = new PlexProvider({ ...CFG, resolutionCache: cache });
    expect(await p.resolve({ title: 'T', artist: 'A' })).toBe('/p/live');
    expect(cache.sets[0][0]).toBe('plex:https://plex.example:32400');
    expect(cache.sets[0][2]).toBe('/p/live');
  });
});

describe('PlexProvider playback', () => {
  it('sets audio.src to the stream URL on load', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse('/library/parts/7/s.mp3'));
    const p = new PlexProvider(CFG);
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    expect(audio.src).toContain('/library/parts/7/s.mp3');
    expect(audio.src).toContain('X-Plex-Token=TK');
  });

  it('maps audio events to provider states', () => {
    const states: ProviderState[] = [];
    const p = new PlexProvider(CFG);
    p.onStateChange((s) => states.push(s));
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('pause'));
    audio.dispatchEvent(new Event('ended'));
    audio.dispatchEvent(new Event('error'));
    expect(states).toEqual(['playing', 'paused', 'ended', 'error']);
  });

  it('seek sets currentTime (ms → s) and progress emits ms', () => {
    const p = new PlexProvider(CFG);
    const events: [number, number][] = [];
    p.onProgress((pos) => events.push([pos, 0]));
    p.seek(30000);
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    expect(audio.currentTime).toBe(30);
    audio.currentTime = 12;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(events.at(-1)![0]).toBe(12000);
  });

  it('evicts and re-resolves a stale cached part key that errors before playing', async () => {
    const cache = new FakeCache();
    cache.set('plex:https://plex.example:32400', 'q:a|t', '/p/stale');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse('/p/fresh'));
    const p = new PlexProvider({ ...CFG, resolutionCache: cache });
    await p.load({ title: 't', artist: 'a' });
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    expect(audio.src).toContain('/p/stale');
    audio.dispatchEvent(new Event('error'));
    await new Promise((r) => setTimeout(r, 0));
    expect(cache.get('plex:https://plex.example:32400', 'q:a|t')).toBe('/p/fresh');
    expect(audio.src).toContain('/p/fresh');
  });
});

function fakeAuth(over: Partial<PlexAuthLike> = {}): PlexAuthLike {
  const session: PlexSession = { baseUrl: 'https://s.example:32400', token: 'AT' };
  return {
    hasSession: () => false,
    getSession: async () => null,
    link: async () => session,
    logout: () => {},
    pendingServers: () => [],
    selectServer: async () => session,
    ...over,
  };
}

describe('PlexProvider auth integration', () => {
  it('uses config token-in directly (linked, no link action)', async () => {
    const p = new PlexProvider(CFG);
    await p.initialize();
    expect(p.getAuthState()).toEqual({
      status: 'Linked',
      actions: [{ id: 'unlink', label: 'Unlink Plex' }],
      busy: false,
    });
  });

  it('uses a cached session when present', async () => {
    const p = new PlexProvider({
      auth: fakeAuth({
        hasSession: () => true,
        getSession: async () => ({ baseUrl: 'https://c.example:32400', token: 'CT' }),
      }),
    });
    await p.initialize();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse('/p/1'));
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    expect(audio.src).toContain('https://c.example:32400/p/1');
    expect(audio.src).toContain('X-Plex-Token=CT');
  });

  it('offers a Link action with no session, then links on runAuthAction', async () => {
    const p = new PlexProvider({ auth: fakeAuth() });
    await p.initialize();
    expect(p.getAuthState().actions).toEqual([{ id: 'link', label: 'Link Plex' }]);
    await p.runAuthAction('link');
    expect((p as unknown as { token: string }).token).toBe('AT');
    expect(p.getAuthState().actions[0].id).toBe('unlink');
  });

  it('fires onReset + onAuthChange when the user unlinks', async () => {
    let reset = 0;
    let changes = 0;
    const p = new PlexProvider({
      auth: fakeAuth({
        hasSession: () => true,
        getSession: async () => ({ baseUrl: 'https://c.example:32400', token: 'CT' }),
      }),
    });
    p.onReset(() => (reset += 1));
    p.onAuthChange(() => (changes += 1));
    await p.initialize();
    await p.runAuthAction('unlink');
    expect(p.getAuthState().actions[0].id).toBe('link');
    expect(reset).toBe(1);
    expect(changes).toBeGreaterThan(0);
  });

  it('logs out and clears the token on unlink', async () => {
    let loggedIn = true;
    const p = new PlexProvider({
      auth: fakeAuth({
        hasSession: () => loggedIn,
        getSession: async () =>
          loggedIn ? { baseUrl: 'https://c.example:32400', token: 'CT' } : null,
        logout: () => {
          loggedIn = false;
        },
      }),
    });
    await p.initialize();
    expect(p.getAuthState().actions[0].id).toBe('unlink');
    await p.runAuthAction('unlink');
    expect(loggedIn).toBe(false);
    expect((p as unknown as { token: string }).token).toBe('');
    expect(p.getAuthState().actions[0].id).toBe('link');
  });

  it('offers a server picker when linking returns multiple servers', async () => {
    const p = new PlexProvider({
      auth: fakeAuth({
        link: async () => ({
          servers: [
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
          ],
        }),
        selectServer: async () => ({ baseUrl: 'https://picked:32400', token: 'PT' }),
      }),
    });
    await p.initialize();
    await p.runAuthAction('link');
    expect(p.getAuthState().actions).toEqual([
      { id: 'server:a', label: 'A' },
      { id: 'server:b', label: 'B' },
    ]);
    await p.runAuthAction('server:b');
    expect((p as unknown as { token: string }).token).toBe('PT');
    expect(p.getAuthState().actions[0].id).toBe('unlink');
  });
});
