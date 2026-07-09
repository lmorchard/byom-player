import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JellyfinProvider, pickAudioItemId } from './JellyfinProvider';
import type { ProviderState } from './types';
import type { ResolutionCache } from './resolutionCache';

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

// An /Items response wrapping zero or one Audio item (artist defaults so
// single-result resolves still return the id via the first-result fallback).
function itemsResponse(id: string | null, artist = 'A', name = 'X') {
  const items = id ? [{ Id: id, Type: 'Audio', Name: name, Artists: [artist] }] : [];
  return {
    ok: true,
    json: async () => ({ Items: items, TotalRecordCount: items.length }),
  } as Response;
}

// A /Users/AuthenticateByName response.
function authResponse(token: string, userId: string) {
  return { ok: true, json: async () => ({ AccessToken: token, User: { Id: userId } }) } as Response;
}

beforeEach(() => {
  installLocalStorage();
  globalThis.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage?.clear();
});

// Token-in config with a stable deviceId (so header assertions are deterministic).
const CFG = { baseUrl: 'https://jf.example', token: 'TK', userId: 'U1', deviceId: 'DID' };

describe('pickAudioItemId', () => {
  it('prefers the artist-matched item among same-title results', () => {
    const data = {
      Items: [
        { Id: 'rush', Type: 'Audio', Name: 'Intro', Artists: ['Rush'] },
        { Id: 'sp', Type: 'Audio', Name: 'Intro', Artists: ['Skinny Puppy'] },
      ],
    };
    expect(pickAudioItemId(data, 'Skinny Puppy')).toBe('sp');
  });
  it('normalizes case/whitespace when matching the artist', () => {
    const data = {
      Items: [{ Id: 'x', Type: 'Audio', Name: 'Intro', Artists: ['Insane Clown Posse    '] }],
    };
    expect(pickAudioItemId(data, 'insane clown posse')).toBe('x');
  });
  it('falls back to the AlbumArtist field when Artists has no match', () => {
    const data = {
      Items: [{ Id: 'y', Type: 'Audio', Name: 'X', AlbumArtist: 'Boards of Canada' }],
    };
    expect(pickAudioItemId(data, 'Boards of Canada')).toBe('y');
  });
  it('falls back to the first result when no artist matches', () => {
    const data = {
      Items: [
        { Id: 'first', Type: 'Audio', Name: 'X', Artists: ['A'] },
        { Id: 'second', Type: 'Audio', Name: 'X', Artists: ['B'] },
      ],
    };
    expect(pickAudioItemId(data, 'Nonexistent')).toBe('first');
  });
  it('skips non-Audio items and returns null for empty / missing / malformed', () => {
    expect(pickAudioItemId({ Items: [{ Id: 'alb', Type: 'MusicAlbum' }] }, 'A')).toBeNull();
    expect(pickAudioItemId({ Items: [] }, 'A')).toBeNull();
    expect(pickAudioItemId({}, 'A')).toBeNull();
    expect(pickAudioItemId(null, 'A')).toBeNull();
  });
});

describe('JellyfinProvider auth', () => {
  it('token-in mode: initialize does not touch the API and reports ready', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const states: ProviderState[] = [];
    const p = new JellyfinProvider(CFG);
    p.onStateChange((s) => states.push(s));
    await p.initialize();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(states).toContain('ready');
  });

  it('username/password: authenticates via /Users/AuthenticateByName, then uses the token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(authResponse('AT', 'U9'));
    const p = new JellyfinProvider({
      baseUrl: 'https://jf.example',
      username: 'u',
      password: 'p',
      deviceId: 'DID',
      cache: false,
    });
    await p.initialize();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/Users/AuthenticateByName');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ Username: 'u', Pw: 'p' });
    const authArg = (init.headers as Record<string, string>).Authorization;
    expect(authArg).toContain('MediaBrowser');
    expect(authArg).toContain('Client="byom-player"');
    expect(authArg).toContain('DeviceId="DID"');
    expect(authArg).not.toContain('Token='); // no token on the initial auth call

    // Subsequent API calls carry the obtained token as an api_key query param.
    fetchMock.mockResolvedValue(itemsResponse('vid1'));
    await p.resolve({ title: 'T', artist: 'A' });
    const resolveUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(resolveUrl.searchParams.get('api_key')).toBe('AT');
  });

  it('emits error when authentication fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);
    const states: ProviderState[] = [];
    const p = new JellyfinProvider({
      baseUrl: 'https://jf.example',
      username: 'u',
      password: 'bad',
      deviceId: 'DID',
      cache: false,
    });
    p.onStateChange((s) => states.push(s));
    await p.initialize();
    expect(states).toContain('error');
  });
});

describe('JellyfinProvider resolution', () => {
  it('searches /Items by TITLE (not artist+title) with api_key auth and returns the id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(itemsResponse('abc', 'Kavinsky', 'Nightcall'));
    const p = new JellyfinProvider({ ...CFG, cache: false });
    const id = await p.resolve({ title: 'Nightcall', artist: 'Kavinsky' });
    expect(id).toBe('abc');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/Items');
    expect(url.searchParams.get('searchTerm')).toBe('Nightcall'); // title only
    expect(url.searchParams.get('includeItemTypes')).toBe('Audio');
    expect(url.searchParams.get('recursive')).toBe('true');
    expect(url.searchParams.get('api_key')).toBe('TK');
    expect(url.searchParams.get('userId')).toBe('U1');
  });

  it('streamUrl targets /Audio/{id}/universal with api_key + userId + deviceId', () => {
    const p = new JellyfinProvider(CFG);
    const u = new URL(p.streamUrl('vid42'));
    expect(u.origin + u.pathname).toBe('https://jf.example/Audio/vid42/universal');
    expect(u.searchParams.get('api_key')).toBe('TK');
    expect(u.searchParams.get('userId')).toBe('U1');
    expect(u.searchParams.get('deviceId')).toBe('DID');
  });

  it('caches a resolved id (scoped by baseUrl); negative-caches a miss', async () => {
    const cache = new FakeCache();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(itemsResponse('live'));
    const p = new JellyfinProvider({ ...CFG, resolutionCache: cache });
    expect(await p.resolve({ title: 'T', artist: 'A' })).toBe('live');
    expect(cache.sets[0][0]).toBe('jellyfin:https://jf.example');
    expect(cache.sets[0][2]).toBe('live');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(itemsResponse(null));
    expect(await p.resolve({ title: 'Z', artist: 'Q' })).toBeNull();
    expect(cache.misses[0][0]).toBe('jellyfin:https://jf.example');
  });

  it('returns a cached id without fetching', async () => {
    const cache = new FakeCache();
    cache.set('jellyfin:https://jf.example', 'q:a|t', 'cachedVid');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const p = new JellyfinProvider({ ...CFG, resolutionCache: cache });
    expect(await p.resolve({ title: 't', artist: 'a' })).toBe('cachedVid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('load emits unavailable on no match, error on transient failure', async () => {
    const states: ProviderState[] = [];
    const p = new JellyfinProvider({ ...CFG, cache: false });
    p.onStateChange((s) => states.push(s));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(itemsResponse(null));
    await p.load({ title: 'X', artist: 'Y' });
    expect(states).toContain('unavailable');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    await p.load({ title: 'X', artist: 'Y' });
    expect(states).toContain('error');
  });

  it('checkAvailability: available / unavailable / unknown', async () => {
    const p = new JellyfinProvider({ ...CFG, cache: false });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(itemsResponse('v'));
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('available');
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(itemsResponse(null));
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unavailable');
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unknown');
  });

  it('checkAvailability returns unknown WITHOUT probing when there is no token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const p = new JellyfinProvider({
      baseUrl: 'https://jf.example',
      deviceId: 'DID',
      cache: false,
    });
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unknown');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isResolutionCached reflects cache membership (hit or known miss), gated by auth', () => {
    const cache = new FakeCache();
    cache.set('jellyfin:https://jf.example', 'q:a|t', 'v');
    cache.setMiss('jellyfin:https://jf.example', 'q:b|u');
    const p = new JellyfinProvider({ ...CFG, resolutionCache: cache });
    expect(p.isResolutionCached({ title: 't', artist: 'a' })).toBe(true); // hit
    expect(p.isResolutionCached({ title: 'u', artist: 'b' })).toBe(true); // known miss
    expect(p.isResolutionCached({ title: 'z', artist: 'z' })).toBe(false); // absent

    const noToken = new JellyfinProvider({
      baseUrl: 'https://jf.example',
      deviceId: 'DID',
      resolutionCache: cache,
    });
    expect(noToken.isResolutionCached({ title: 't', artist: 'a' })).toBe(true);
  });
});

describe('JellyfinProvider playback', () => {
  it('sets audio.src to the stream URL on load', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(itemsResponse('s7'));
    const p = new JellyfinProvider(CFG);
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    expect(audio.src).toContain('/Audio/s7/universal');
    expect(audio.src).toContain('api_key=TK');
  });

  it('maps audio events to provider states', () => {
    const states: ProviderState[] = [];
    const p = new JellyfinProvider(CFG);
    p.onStateChange((s) => states.push(s));
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('pause'));
    audio.dispatchEvent(new Event('ended'));
    audio.dispatchEvent(new Event('error'));
    expect(states).toEqual(['playing', 'paused', 'ended', 'error']);
  });

  it('seek sets currentTime (ms → s) and progress emits ms', () => {
    const p = new JellyfinProvider(CFG);
    const events: number[] = [];
    p.onProgress((pos) => events.push(pos));
    p.seek(30000);
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    expect(audio.currentTime).toBe(30);
    audio.currentTime = 12;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(events.at(-1)).toBe(12000);
  });

  it('evicts and re-resolves a stale cached id that errors before playing', async () => {
    const cache = new FakeCache();
    cache.set('jellyfin:https://jf.example', 'q:a|t', 'stale');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(itemsResponse('fresh'));
    const p = new JellyfinProvider({ ...CFG, resolutionCache: cache });
    await p.load({ title: 't', artist: 'a' });
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    expect(audio.src).toContain('/Audio/stale/universal');
    audio.dispatchEvent(new Event('error'));
    await new Promise((r) => setTimeout(r, 0));
    expect(cache.get('jellyfin:https://jf.example', 'q:a|t')).toBe('fresh');
    expect(audio.src).toContain('/Audio/fresh/universal');
  });
});
