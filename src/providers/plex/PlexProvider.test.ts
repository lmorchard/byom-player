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
  it('uses config token-in directly (no link button)', async () => {
    const el = document.createElement('div');
    const p = new PlexProvider(CFG);
    p.attach(el);
    await p.initialize();
    expect(el.querySelector('.byom-plex-link')).toBeNull();
  });

  it('uses a cached session when present', async () => {
    const el = document.createElement('div');
    const p = new PlexProvider({
      auth: fakeAuth({
        hasSession: () => true,
        getSession: async () => ({ baseUrl: 'https://c.example:32400', token: 'CT' }),
      }),
    });
    p.attach(el);
    await p.initialize();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse('/p/1'));
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    expect(audio.src).toContain('https://c.example:32400/p/1');
    expect(audio.src).toContain('X-Plex-Token=CT');
  });

  it('renders a Link button with no session, then links + plays on click', async () => {
    const el = document.createElement('div');
    const p = new PlexProvider({ auth: fakeAuth() });
    p.attach(el);
    await p.initialize();
    const btn = el.querySelector('.byom-plex-link') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    await vi.waitFor(() => expect((p as unknown as { token: string }).token).toBe('AT'));
  });

  it('shows a server picker when linking returns multiple servers', async () => {
    const el = document.createElement('div');
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
    p.attach(el);
    await p.initialize();
    (el.querySelector('.byom-plex-link') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(el.querySelectorAll('.byom-plex-server').length).toBe(2));
    (el.querySelectorAll('.byom-plex-server')[1] as HTMLButtonElement).click();
    await vi.waitFor(() => expect((p as unknown as { token: string }).token).toBe('PT'));
  });
});
