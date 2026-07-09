# Plex Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `plex` audio provider that plays JSPF tracks from a Plex Media Server's music library, via HTML5 `<audio>`, with a token-in config path and a turnkey PIN "Link Plex" flow.

**Architecture:** `PlexProvider` implements `AudioProvider` exactly as `SubsonicProvider` does — resolve a track via a search endpoint, build a direct-play stream URL, play it through one `Audio()` element (state from audio events, progress from `timeupdate`, seek via `currentTime`), reusing the generic `resolutionCache`. There is **no engine seam** (playback is plain `<audio>`). A separate `auth.ts` owns the poll-based PIN device-link flow and server/connection discovery; the provider uses either config `{baseUrl, token}`, a cached linked session, or the PIN flow.

**Tech Stack:** Lit + TypeScript, Vitest + happy-dom, Plex Media Server HTTP API, plex.tv PIN (device link) API.

## Global Constraints

- No `import 'node:*'` in `src/` (build's `tsc` has no Node types).
- Playback mirrors `SubsonicProvider` (HTML5 `Audio`); reuse `../resolutionCache` (`trackKey`, `LocalStorageResolutionCache`) and `../types`.
- Verify each task: `npm run lint` (ESLint + Prettier), `npm test` (Vitest), `npm run build` (`tsc --noEmit` + Vite lib build).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Direct-play only (no transcode). Resolution is `artist + title` search.
- Plex token as `X-Plex-Token` query param on server requests; plex.tv calls send `X-Plex-Client-Identifier`, `X-Plex-Product`, `X-Plex-Version`, `Accept: application/json`.
- Tests: mirror `SubsonicProvider.test.ts` patterns (the `installLocalStorage` shim, `FakeCache`, `vi.spyOn(globalThis,'fetch')`, audio-event dispatch). Live Plex behavior is verified manually against Les's real server.

## File Structure

```
src/providers/plex/
  types.ts            # PlexConfig, PlexSession, PlexAuthLike
  PlexProvider.ts     # AudioProvider: resolve → stream URL → <audio>
  PlexProvider.test.ts
  auth.ts             # client id, PIN create/poll, server/connection discovery, session cache
  auth.test.ts
src/providers/registry.ts   # MODIFY: add case 'plex'
index.html                  # MODIFY: Plex option (baseUrl+token + Link button)
README.md                   # MODIFY: Plex section
AGENTS.md                   # MODIFY: plex provider bullet
```

Test helpers (`installLocalStorage`, `FakeCache`) are copied into the Plex test files, matching how `SubsonicProvider.test.ts` defines them locally (the repo has no shared test-util module; keep it consistent rather than introducing one here).

---

## Task 1: Token-in PlexProvider (types, resolution, playback, registry)

**Files:**
- Create: `src/providers/plex/types.ts`
- Create: `src/providers/plex/PlexProvider.ts`
- Create: `src/providers/plex/PlexProvider.test.ts`
- Modify: `src/providers/registry.ts`

**Interfaces:**
- Consumes: `../types` (`Track`), `./providers/types` (`AudioProvider`, `ProviderState`, `AvailabilityStatus`), `../resolutionCache` (`trackKey`, `LocalStorageResolutionCache`, `ResolutionCache`).
- Produces:
  - `types.ts`: `PlexConfig`, `PlexSession { baseUrl; token }`, `PlexAuthLike`, `PLEX_PRODUCT`.
  - `PlexProvider.ts`: `class PlexProvider implements AudioProvider` (`name='plex'`), plus exported pure helper `firstTrackPartKey(data): string | null`.

- [ ] **Step 1: Write `types.ts`**

```ts
// src/providers/plex/types.ts
import type { ResolutionCache } from '../resolutionCache';

export interface PlexSession {
  baseUrl: string;
  token: string;
}

// The subset of the PIN/discovery client the provider depends on (small for fakes).
// Implemented in Task 2-4; Task 1 only references the type via PlexConfig.auth.
export interface PlexAuthLike {
  hasSession(): boolean;
  getSession(): Promise<PlexSession | null>;
  link(): Promise<PlexSession>;
  logout(): void;
  // In the PIN flow, an account with >1 server exposes a picker; see Task 4.
  pendingServers?(): { id: string; name: string }[];
  selectServer?(id: string): Promise<PlexSession>;
}

export interface PlexConfig {
  baseUrl?: string; // token-in: direct server URL
  token?: string; // token-in: X-Plex-Token
  serverName?: string; // PIN flow: auto-select this server when multiple
  product?: string; // X-Plex-Product (default 'byom-player')
  debug?: boolean;
  retries?: number; // extra attempts after the first (default 2)
  retryDelayMs?: number; // base backoff * attempt (default 400)
  cache?: boolean; // default on
  resolutionCache?: ResolutionCache; // test / custom backend injection
  auth?: PlexAuthLike; // test injection of the PIN/discovery client
}

export const PLEX_PRODUCT = 'byom-player';
```

- [ ] **Step 2: Write the failing test**

```ts
// src/providers/plex/PlexProvider.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlexProvider, firstTrackPartKey } from './PlexProvider';
import type { ProviderState } from '../types';
import type { ResolutionCache } from '../resolutionCache';

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
        MediaContainer: { Metadata: [{ type: 'track', Media: [{ Part: [{ key: '/library/parts/1/a.mp3' }] }] }] },
      }),
    ).toBe('/library/parts/1/a.mp3');
  });
  it('reads a part key from MediaContainer.SearchResult[].Metadata', () => {
    expect(
      firstTrackPartKey({
        MediaContainer: {
          SearchResult: [{ Metadata: { type: 'track', Media: [{ Part: [{ key: '/library/parts/2/b.flac' }] }] } }],
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
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(searchResponse('/library/parts/9/x.mp3'));
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
    const p = new PlexProvider({ ...CFG, retryDelayMs: 0 });
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

  it('caches a resolved part key (scoped by baseUrl) and a miss', async () => {
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
```

Note: the stale-recovery test uses `trackKey`'s real key format; the exact literal (`'q:a|t'`) mirrors the Subsonic test's convention — if `trackKey({title:'t',artist:'a'})` produces a different string, use that value (run `trackKey` once to confirm) rather than guessing.

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/providers/plex/PlexProvider.test.ts`
Expected: FAIL — cannot find module `./PlexProvider`.

- [ ] **Step 4: Implement `PlexProvider.ts`**

```ts
// src/providers/plex/PlexProvider.ts
import type { Track } from '../../types';
import type { AudioProvider, AvailabilityStatus, ProviderState } from '../types';
import { trackKey, LocalStorageResolutionCache, type ResolutionCache } from '../resolutionCache';
import type { PlexConfig } from './types';

// Pull the first track's direct-play Part key out of a Plex search response.
// Tolerates both /library/search (SearchResult[].Metadata) and older Metadata[].
export function firstTrackPartKey(data: unknown): string | null {
  const mc = (data as { MediaContainer?: Record<string, unknown> })?.MediaContainer;
  if (!mc) return null;
  const fromSearch = Array.isArray(mc.SearchResult)
    ? (mc.SearchResult as { Metadata?: unknown }[]).map((r) => r?.Metadata)
    : [];
  const fromMeta = Array.isArray(mc.Metadata) ? (mc.Metadata as unknown[]) : [];
  for (const m of [...fromSearch, ...fromMeta].filter(Boolean) as Record<string, any>[]) {
    if (m.type && m.type !== 'track') continue;
    const key = m?.Media?.[0]?.Part?.[0]?.key;
    if (typeof key === 'string') return key;
  }
  return null;
}

// PlexProvider resolves a Track against a Plex Media Server's music library and
// plays the resulting direct-play stream via an HTML5 Audio element. Mirrors
// SubsonicProvider; no engine seam.
export class PlexProvider implements AudioProvider {
  name = 'plex';

  private readonly audio = new Audio();
  private readonly cfg: PlexConfig;
  private readonly listeners = new AbortController();
  private readonly cache: ResolutionCache | null;
  private callback: (s: ProviderState) => void = () => {};
  private progressCallback: (positionMs: number, durationMs: number) => void = () => {};

  // Session (base + token). Set from config here; the PIN flow sets it in Task 4.
  protected base = '';
  protected token = '';

  // Stale-id recovery state (reset in load()).
  private currentTrack: Track | null = null;
  private currentKey: string | null = null;
  private currentFromCache = false;
  private retriedStale = false;
  private hasPlayed = false;

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as PlexConfig;
    this.base = (this.cfg.baseUrl ?? '').replace(/\/$/, '');
    this.token = this.cfg.token ?? '';
    this.cache =
      this.cfg.cache === false
        ? null
        : (this.cfg.resolutionCache ?? new LocalStorageResolutionCache());

    const opts = { signal: this.listeners.signal };
    this.audio.addEventListener(
      'playing',
      () => {
        this.hasPlayed = true;
        this.callback('playing');
      },
      opts,
    );
    this.audio.addEventListener('pause', () => this.callback('paused'), opts);
    this.audio.addEventListener('ended', () => this.callback('ended'), opts);
    this.audio.addEventListener('error', () => this.handleAudioError(), opts);
    this.audio.addEventListener('timeupdate', () => this.emitProgress(), opts);
    this.audio.addEventListener('durationchange', () => this.emitProgress(), opts);
  }

  private get scope(): string {
    return 'plex:' + this.base;
  }

  async initialize(): Promise<void> {
    // Token-in path (Task 1). The PIN / cached-session paths are added in Task 4.
    this.callback('ready');
  }

  async load(track: Track): Promise<void> {
    this.currentTrack = track;
    this.currentKey = trackKey(track);
    this.retriedStale = false;
    this.hasPlayed = false;
    this.currentFromCache = !!this.cache?.get(this.scope, this.currentKey);
    let key: string | null;
    try {
      key = await this.resolve(track);
    } catch (err) {
      this.log('resolve error', track.artist, '-', track.title, err);
      this.callback('error');
      return;
    }
    if (!key) {
      this.log('not in library', track.artist, '-', track.title);
      this.callback('unavailable');
      return;
    }
    this.audio.src = this.streamUrl(key);
    this.callback('ready');
  }

  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch {
      this.callback('error');
    }
  }
  pause(): void {
    this.audio.pause();
  }
  seek(positionMs: number): void {
    this.audio.currentTime = positionMs / 1000;
  }
  onStateChange(cb: (s: ProviderState) => void): void {
    this.callback = cb;
  }
  onProgress(cb: (positionMs: number, durationMs: number) => void): void {
    this.progressCallback = cb;
  }
  dispose(): void {
    this.listeners.abort();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  async resolve(track: Track): Promise<string | null> {
    const key = trackKey(track);
    const cached = this.cache?.get(this.scope, key);
    if (cached) return cached;
    if (cached === null) return null;
    const query = `${track.artist} ${track.title}`.trim();
    const data = await this.fetchJson(
      this.apiUrl('/library/search', { query, searchTypes: 'music', limit: '5' }),
    );
    const partKey = firstTrackPartKey(data);
    if (partKey) this.cache?.set(this.scope, key, partKey);
    else this.cache?.setMiss(this.scope, key);
    return partKey;
  }

  async checkAvailability(track: Track): Promise<AvailabilityStatus> {
    try {
      return (await this.resolve(track)) ? 'available' : 'unavailable';
    } catch {
      return 'unknown';
    }
  }

  streamUrl(partKey: string): string {
    const url = new URL(this.base + partKey);
    url.searchParams.set('X-Plex-Token', this.token);
    return url.toString();
  }

  private apiUrl(path: string, params: Record<string, string> = {}): string {
    const url = new URL(this.base + path);
    url.searchParams.set('X-Plex-Token', this.token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }

  private async fetchJson(url: string): Promise<unknown> {
    const retries = this.cfg.retries ?? 2;
    const baseDelay = this.cfg.retryDelayMs ?? 400;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        if (attempt >= retries) throw err;
        await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
      }
    }
  }

  // A cached part key that errors before ever playing is likely stale (library
  // rescan changed part ids): evict and re-resolve once. Mirrors Subsonic.
  private handleAudioError(): void {
    if (
      !this.hasPlayed &&
      this.currentFromCache &&
      !this.retriedStale &&
      this.cache &&
      this.currentTrack &&
      this.currentKey
    ) {
      this.retriedStale = true;
      this.cache.evict(this.scope, this.currentKey);
      void this.reloadFresh(this.currentTrack);
      return;
    }
    this.callback('error');
  }

  private async reloadFresh(track: Track): Promise<void> {
    this.currentFromCache = false;
    let key: string | null;
    try {
      key = await this.resolve(track);
    } catch {
      this.callback('error');
      return;
    }
    if (!key) {
      this.callback('unavailable');
      return;
    }
    this.audio.src = this.streamUrl(key);
    void this.play();
  }

  private emitProgress(): void {
    const durationS = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.progressCallback(this.audio.currentTime * 1000, durationS * 1000);
  }

  private log(...args: unknown[]): void {
    if (this.cfg.debug) console.debug('[byom-player:plex]', ...args);
  }
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/providers/plex/PlexProvider.test.ts`
Expected: PASS. (If the stale test's key literal mismatches, fix it to the real `trackKey` output.)

- [ ] **Step 6: Register the provider**

Edit `src/providers/registry.ts`:
```ts
import { PlexProvider } from './plex/PlexProvider';
```
```ts
    case 'plex':
      return new PlexProvider(config);
```
Append to `src/providers/registry.test.ts`:
```ts
  it('creates a plex provider', () => {
    const p = createProvider('plex', { baseUrl: 'https://plex.example:32400', token: 'TK' });
    expect(p.name).toBe('plex');
  });
```

- [ ] **Step 7: Verify + commit**

```bash
npm run format && npm run lint && npm test && npm run build
git add src/providers/plex/types.ts src/providers/plex/PlexProvider.ts src/providers/plex/PlexProvider.test.ts src/providers/registry.ts src/providers/registry.test.ts
git commit -m "feat(plex): token-in provider — resolve + direct-play via HTML5 audio" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: PIN device-link auth core (client id, PIN create/poll, session cache)

**Files:**
- Create: `src/providers/plex/auth.ts`
- Create: `src/providers/plex/auth.test.ts`

**Interfaces:**
- Consumes: `./types` (`PlexSession`, `PlexAuthLike`, `PLEX_PRODUCT`).
- Produces:
  - `clientIdentifier(storage?): string`
  - `class PlexAuth implements PlexAuthLike` with `constructor(cfg, deps?: { fetch?; win?; storage?; now?; discover? })`. This task implements identity + PIN create/poll + session persistence + `logout`; **server discovery is stubbed via an injectable `discover` dependency** whose real implementation lands in Task 3.
  - Exported low-level fns for unit tests: `createPin(deps)`, `pollPin(deps, id)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/providers/plex/auth.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlexAuth, clientIdentifier } from './auth';
import type { PlexSession } from './types';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
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

afterEach(() => vi.restoreAllMocks());

describe('clientIdentifier', () => {
  it('generates once and persists', () => {
    const s = fakeStorage();
    const a = clientIdentifier(s);
    expect(a).toMatch(/\S/);
    expect(clientIdentifier(s)).toBe(a); // stable
  });
});

describe('PlexAuth PIN flow', () => {
  const SESSION: PlexSession = { baseUrl: 'https://s.plex.direct:32400', token: 'ACCESS' };

  function deps(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      storage: fakeStorage(),
      now: () => 0,
      discover: vi.fn(async () => SESSION), // real impl in Task 3
      ...overrides,
    };
  }

  it('creates a pin, opens the auth popup, polls until authToken, then discovers a session', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/pins?strong=true') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 42, code: 'ABCD' }) } as Response;
      }
      if (url.includes('/pins/42')) {
        calls++;
        return { ok: true, json: async () => ({ authToken: calls >= 2 ? 'ACCOUNT' : null }) } as Response;
      }
      throw new Error('unexpected ' + url);
    });
    const popup = { closed: false, close: vi.fn(), location: { href: '' } };
    const win = { open: vi.fn(() => popup) } as unknown as Window;
    const d = deps();
    const auth = new PlexAuth({ product: 'byom-player' }, { ...d, fetch: fetchMock, win, pollIntervalMs: 0 });

    const session = await auth.link();
    expect(win.open).toHaveBeenCalled();
    expect(String((win.open as any).mock.calls[0][0])).toContain('app.plex.tv/auth');
    expect(d.discover).toHaveBeenCalledWith('ACCOUNT');
    expect(session).toEqual(SESSION);
    expect(auth.hasSession()).toBe(true); // persisted
  });

  it('getSession returns the cached session; logout clears it', async () => {
    const d = deps();
    const auth = new PlexAuth({}, { ...d, fetch: vi.fn(), win: {} as Window });
    expect(await auth.getSession()).toBeNull();
    // seed via a successful link
    // (simulate by writing through the same storage key the impl uses)
    auth['persist'](SESSION as PlexSession);
    expect(auth.hasSession()).toBe(true);
    expect(await auth.getSession()).toEqual(SESSION);
    auth.logout();
    expect(auth.hasSession()).toBe(false);
  });

  it('rejects when the popup is closed before authorization', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/pins?strong=true')) return { ok: true, json: async () => ({ id: 1, code: 'C' }) } as Response;
      return { ok: true, json: async () => ({ authToken: null }) } as Response; // never authorizes
    });
    const popup = { closed: true, close: vi.fn() };
    const win = { open: vi.fn(() => popup) } as unknown as Window;
    const auth = new PlexAuth({}, { ...deps(), fetch: fetchMock, win, pollIntervalMs: 0, maxPolls: 3 });
    await expect(auth.link()).rejects.toThrow(/closed|timed out/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/providers/plex/auth.test.ts`
Expected: FAIL — cannot find module `./auth`.

- [ ] **Step 3: Implement `auth.ts` (identity + PIN + persistence; discovery injected)**

```ts
// src/providers/plex/auth.ts
import { PLEX_PRODUCT, type PlexAuthLike, type PlexConfig, type PlexSession } from './types';

const PLEX_TV = 'https://plex.tv/api/v2';
const AUTH_APP = 'https://app.plex.tv/auth';
const CLIENT_ID_KEY = 'byom-plex:client-id';
const SESSION_KEY = 'byom-plex:session';

type Fetch = typeof fetch;
type Discover = (accountToken: string) => Promise<PlexSession>;

export function clientIdentifier(storage: Storage = localStorage): string {
  let id = storage.getItem(CLIENT_ID_KEY);
  if (!id) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    storage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export interface PlexAuthDeps {
  fetch?: Fetch;
  win?: Window;
  storage?: Storage;
  now?: () => number;
  discover?: Discover; // real implementation supplied in Task 3 (server discovery)
  pollIntervalMs?: number;
  maxPolls?: number;
}

export class PlexAuth implements PlexAuthLike {
  private readonly fetch: Fetch;
  private readonly win: Window;
  private readonly storage: Storage;
  private readonly discover: Discover;
  private readonly pollIntervalMs: number;
  private readonly maxPolls: number;
  private readonly product: string;
  private readonly clientId: string;

  constructor(cfg: PlexConfig, deps: PlexAuthDeps = {}) {
    this.fetch = deps.fetch ?? fetch.bind(globalThis);
    this.win = deps.win ?? window;
    this.storage = deps.storage ?? localStorage;
    // Task 3 replaces the default with real server discovery.
    this.discover =
      deps.discover ??
      (async () => {
        throw new Error('Plex server discovery not configured');
      });
    this.pollIntervalMs = deps.pollIntervalMs ?? 1500;
    this.maxPolls = deps.maxPolls ?? 120; // ~3 min at 1.5s
    this.product = cfg.product ?? PLEX_PRODUCT;
    this.clientId = clientIdentifier(this.storage);
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'X-Plex-Product': this.product,
      'X-Plex-Client-Identifier': this.clientId,
      'X-Plex-Version': '1',
    };
  }

  hasSession(): boolean {
    return this.storage.getItem(SESSION_KEY) !== null;
  }

  async getSession(): Promise<PlexSession | null> {
    const raw = this.storage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlexSession;
    } catch {
      return null;
    }
  }

  logout(): void {
    this.storage.removeItem(SESSION_KEY);
  }

  protected persist(session: PlexSession): void {
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async link(): Promise<PlexSession> {
    const pin = await this.createPin();
    const url = `${AUTH_APP}#?clientID=${encodeURIComponent(this.clientId)}&code=${encodeURIComponent(
      pin.code,
    )}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(this.product)}`;
    const popup = this.win.open(url, 'plex-link', 'width=600,height=720');
    const accountToken = await this.pollForToken(pin.id, popup);
    const session = await this.discover(accountToken);
    this.persist(session);
    try {
      popup?.close();
    } catch {
      /* ignore */
    }
    return session;
  }

  private async createPin(): Promise<{ id: number; code: string }> {
    const res = await this.fetch(`${PLEX_TV}/pins?strong=true`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Plex pin request failed: ${res.status}`);
    const data = (await res.json()) as { id: number; code: string };
    return { id: data.id, code: data.code };
  }

  private async pollForToken(id: number, popup: Window | null): Promise<string> {
    for (let i = 0; i < this.maxPolls; i++) {
      if (popup?.closed) throw new Error('Plex login popup was closed');
      const res = await this.fetch(`${PLEX_TV}/pins/${id}`, { headers: this.headers() });
      const data = (await res.json()) as { authToken: string | null };
      if (data.authToken) return data.authToken;
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
    throw new Error('Plex authorization timed out');
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/providers/plex/auth.test.ts`
Expected: PASS. (The popup-closed test relies on `popup.closed === true` on the first poll iteration.)

- [ ] **Step 5: Verify + commit**

```bash
npm run format && npm run lint && npm test && npm run build
git add src/providers/plex/auth.ts src/providers/plex/auth.test.ts
git commit -m "feat(plex): PIN device-link auth core (client id, pin poll, session cache)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Server + connection discovery

**Files:**
- Modify: `src/providers/plex/auth.ts`
- Modify: `src/providers/plex/auth.test.ts`

**Interfaces:**
- Consumes: Task 2's `PlexAuth`, `headers()`, `fetch`, `cfg.serverName`.
- Produces:
  - `discoverSession(deps, accountToken, opts): Promise<{ session?: PlexSession; servers?: {id;name}[] }>` — resolves a `PlexSession` when exactly one server (or a `serverName`/single match), otherwise returns the server list for a picker.
  - `pickConnection(fetch, headers, connections, accessToken): Promise<string>` — returns the first reachable connection `uri` (prefers `local`, then `plex.direct`), probing `GET {uri}/identity`.
  - Wires `PlexAuth` to use real discovery by default (removes the throwing stub), and adds `pendingServers()` / `selectServer(id)`.

- [ ] **Step 1: Write failing tests for discovery + connection selection**

```ts
// add to src/providers/plex/auth.test.ts
import { discoverSession, pickConnection } from './auth';

describe('pickConnection', () => {
  it('prefers a reachable local connection, falls back to plex.direct', async () => {
    const conns = [
      { local: false, uri: 'https://remote.plex.direct:32400' },
      { local: true, uri: 'https://192.168.1.9:32400' },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // local /identity fails, remote succeeds
      if (url.startsWith('https://192.168.1.9')) throw new Error('unreachable');
      return { ok: true } as Response;
    });
    const uri = await pickConnection(fetchMock as typeof fetch, {}, conns, 'ACCESS');
    expect(uri).toBe('https://remote.plex.direct:32400');
  });
});

describe('discoverSession', () => {
  const resources = [
    {
      name: 'Home',
      provides: 'server',
      clientIdentifier: 'srv-1',
      accessToken: 'ACCESS1',
      connections: [{ local: true, uri: 'https://192.168.1.9:32400' }],
    },
  ];
  function fetchWith(resourcesJson: unknown) {
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/resources')) return { ok: true, json: async () => resourcesJson } as Response;
      if (url.includes('/identity')) return { ok: true } as Response;
      throw new Error('unexpected ' + url);
    });
  }

  it('auto-selects the only server and resolves a session', async () => {
    const out = await discoverSession(
      { fetch: fetchWith(resources) as typeof fetch, headers: {} },
      'ACCOUNT',
      {},
    );
    expect(out.session).toEqual({ baseUrl: 'https://192.168.1.9:32400', token: 'ACCESS1' });
  });

  it('returns the server list when there are multiple and no serverName', async () => {
    const two = [
      { ...resources[0], clientIdentifier: 'a', name: 'A' },
      { ...resources[0], clientIdentifier: 'b', name: 'B' },
    ];
    const out = await discoverSession(
      { fetch: fetchWith(two) as typeof fetch, headers: {} },
      'ACCOUNT',
      {},
    );
    expect(out.session).toBeUndefined();
    expect(out.servers).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
  });

  it('auto-selects by serverName when multiple', async () => {
    const two = [
      { ...resources[0], clientIdentifier: 'a', name: 'A' },
      { ...resources[0], clientIdentifier: 'b', name: 'B' },
    ];
    const out = await discoverSession(
      { fetch: fetchWith(two) as typeof fetch, headers: {} },
      'ACCOUNT',
      { serverName: 'B' },
    );
    expect(out.session?.token).toBe('ACCESS1');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/providers/plex/auth.test.ts`
Expected: FAIL — `discoverSession`/`pickConnection` not exported.

- [ ] **Step 3: Implement discovery in `auth.ts`**

Add these exports and wire `PlexAuth`:
```ts
interface PlexResource {
  name: string;
  provides: string;
  clientIdentifier: string;
  accessToken: string;
  connections: { local: boolean; uri: string }[];
}

export async function pickConnection(
  fetchFn: Fetch,
  headers: Record<string, string>,
  connections: { local: boolean; uri: string }[],
  accessToken: string,
): Promise<string> {
  const ordered = [...connections].sort((a, b) => Number(b.local) - Number(a.local));
  for (const c of ordered) {
    try {
      const res = await fetchFn(`${c.uri.replace(/\/$/, '')}/identity`, {
        headers: { ...headers, 'X-Plex-Token': accessToken },
      });
      if (res.ok) return c.uri.replace(/\/$/, '');
    } catch {
      /* try next */
    }
  }
  throw new Error('No reachable Plex connection');
}

export async function discoverSession(
  deps: { fetch: Fetch; headers: Record<string, string> },
  accountToken: string,
  opts: { serverName?: string },
): Promise<{ session?: PlexSession; servers?: { id: string; name: string }[] }> {
  const res = await deps.fetch(`${PLEX_TV}/resources?includeHttps=1`, {
    headers: { ...deps.headers, 'X-Plex-Token': accountToken },
  });
  if (!res.ok) throw new Error(`Plex resources request failed: ${res.status}`);
  const all = (await res.json()) as PlexResource[];
  const servers = all.filter((r) => r.provides?.split(',').includes('server'));
  if (servers.length === 0) throw new Error('No Plex servers on this account');

  let chosen: PlexResource | undefined;
  if (opts.serverName) chosen = servers.find((s) => s.name === opts.serverName);
  else if (servers.length === 1) chosen = servers[0];

  if (!chosen) {
    return { servers: servers.map((s) => ({ id: s.clientIdentifier, name: s.name })) };
  }
  const baseUrl = await pickConnection(deps.fetch, deps.headers, chosen.connections, chosen.accessToken);
  return { session: { baseUrl, token: chosen.accessToken } };
}
```

Then update `PlexAuth`:
- Store `cfg` and `serverName`; keep the account token + discovered server list as fields so `selectServer` can complete a deferred pick.
- Default `discover` (replace the throwing stub) to call `discoverSession`, persisting when a single session comes back and stashing `servers` + `accountToken` when a picker is needed.
- Add:
```ts
  pendingServers(): { id: string; name: string }[] {
    return this.servers ?? [];
  }
  async selectServer(id: string): Promise<PlexSession> {
    if (!this.accountToken) throw new Error('link() must run before selectServer()');
    const res = await this.fetch(`${PLEX_TV}/resources?includeHttps=1`, {
      headers: { ...this.headers(), 'X-Plex-Token': this.accountToken },
    });
    const all = (await res.json()) as PlexResource[];
    const srv = all.find((r) => r.clientIdentifier === id);
    if (!srv) throw new Error('Unknown Plex server');
    const baseUrl = await pickConnection(this.fetch, this.headers(), srv.connections, srv.accessToken);
    const session = { baseUrl, token: srv.accessToken };
    this.persist(session);
    return session;
  }
```
- Change `link()`: after `pollForToken`, store `this.accountToken`, then call `discoverSession({fetch,headers}, token, {serverName})`. If `session`, persist + return it. If `servers`, store `this.servers` and throw a typed `PlexServerChoiceNeeded` (or return a sentinel the provider inspects) — **for the provider's benefit in Task 4**. Keep it simple: set `this.servers` and return `null`-guarded via a `link()` that resolves to `{ session?, servers? }`. Update the `PlexAuthLike.link` signature in `types.ts` to `Promise<PlexSession | { servers: {id;name}[] }>` and adjust the Task 2 test's expectation to the single-server session shape.

Note: this changes `link()`'s return type from Task 2. Update `types.ts` `PlexAuthLike.link` and the Task 2 `link()` test accordingly (single-server case still returns a `PlexSession`). Keep the union small: `type LinkResult = PlexSession | { servers: { id: string; name: string }[] }`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/providers/plex/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify + commit**

```bash
npm run format && npm run lint && npm test && npm run build
git add src/providers/plex/auth.ts src/providers/plex/auth.test.ts src/providers/plex/types.ts
git commit -m "feat(plex): server + connection discovery (auto-select, picker, /identity probe)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Provider ↔ auth integration (path selection, Link/picker/Unlink UI)

**Files:**
- Modify: `src/providers/plex/PlexProvider.ts`
- Modify: `src/providers/plex/PlexProvider.test.ts`

**Interfaces:**
- Consumes: `PlexAuthLike` (`hasSession`/`getSession`/`link`/`logout`/`pendingServers`/`selectServer`), the `LinkResult` union.
- Produces: an `initialize()` + `attach()` that select the session source and render the link/picker/unlink controls into the attach surface (paralleling the Spotify provider's connect/disconnect UI).

- [ ] **Step 1: Add failing tests (fake auth)**

```ts
// add to src/providers/plex/PlexProvider.test.ts
import type { PlexAuthLike, PlexSession } from './types';

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
      auth: fakeAuth({ hasSession: () => true, getSession: async () => ({ baseUrl: 'https://c.example:32400', token: 'CT' }) }),
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/providers/plex/PlexProvider.test.ts`
Expected: FAIL — link button / session wiring not implemented.

- [ ] **Step 3: Implement in `PlexProvider.ts`**

Add an `auth` field + `target`, and rewrite `initialize()`:
```ts
  private readonly auth?: PlexAuthLike;
  private target: HTMLElement | null = null;
```
In the constructor, after cache setup: `this.auth = this.cfg.auth ?? (this.cfg.baseUrl && this.cfg.token ? undefined : new PlexAuth(this.cfg));`
(import `PlexAuth` from `./auth`.)

```ts
  attach(element: HTMLElement): void {
    this.target = element;
  }

  async initialize(): Promise<void> {
    if (this.base && this.token) {
      this.callback('ready'); // token-in
      return;
    }
    const existing = await this.auth?.getSession();
    if (existing) {
      this.applySession(existing);
      this.callback('ready');
      return;
    }
    this.renderLink();
    this.callback('ready');
  }

  private applySession(s: PlexSession): void {
    this.base = s.baseUrl.replace(/\/$/, '');
    this.token = s.token;
  }

  private renderLink(): void {
    if (!this.target) return;
    this.target.replaceChildren();
    const btn = this.target.ownerDocument.createElement('button');
    btn.className = 'byom-plex-link';
    btn.textContent = 'Link Plex';
    btn.addEventListener('click', () => void this.handleLink(btn));
    this.target.appendChild(btn);
  }

  private async handleLink(btn: HTMLButtonElement): Promise<void> {
    if (!this.auth) return;
    btn.disabled = true;
    try {
      const result = await this.auth.link();
      if ('servers' in result) {
        this.renderPicker(result.servers);
        return;
      }
      this.applySession(result);
      this.target?.replaceChildren();
    } catch (err) {
      this.log('link failed', err);
      btn.disabled = false;
      this.callback('error');
    }
  }

  private renderPicker(servers: { id: string; name: string }[]): void {
    if (!this.target) return;
    this.target.replaceChildren();
    for (const s of servers) {
      const b = this.target.ownerDocument.createElement('button');
      b.className = 'byom-plex-server';
      b.textContent = s.name;
      b.addEventListener('click', () => void this.handlePick(s.id));
      this.target.appendChild(b);
    }
  }

  private async handlePick(id: string): Promise<void> {
    if (!this.auth?.selectServer) return;
    try {
      this.applySession(await this.auth.selectServer(id));
      this.target?.replaceChildren();
    } catch (err) {
      this.log('server select failed', err);
      this.callback('error');
    }
  }
```
(Add `import { PlexAuth } from './auth';` and `import type { PlexSession, PlexAuthLike } from './types';`.)

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/providers/plex/PlexProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify + commit**

```bash
npm run format && npm run lint && npm test && npm run build
git add src/providers/plex/PlexProvider.ts src/providers/plex/PlexProvider.test.ts
git commit -m "feat(plex): wire PIN auth into the provider (link button, server picker, cached session)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Dev harness Plex option

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add a Plex option matching the existing provider fieldsets**

Read `index.html`'s provider `<select>`, fieldset pattern, `syncProviderUI()`, and `buildProviderConfig()` (as extended for Spotify). Add:
- `<option value="plex">plex</option>`.
- `<fieldset id="fs-plex">` with `baseUrl` (`plexBaseUrl`) and `token` (`plexToken`) inputs and a note: leave both blank to use the in-player **Link Plex** button.
- `syncProviderUI()`: `document.getElementById('fs-plex').hidden = provider !== 'plex';`
- `buildProviderConfig()`:
```js
        if (cfg.provider === 'plex') {
          const c = {};
          if (cfg.plexBaseUrl) c.baseUrl = cfg.plexBaseUrl;
          if (cfg.plexToken) c.token = cfg.plexToken;
          return c;
        }
```
Match the file's existing markup/JS style rather than inventing a new pattern.

- [ ] **Step 2: Manual smoke (documented; needs Les's real Plex server)**

Run `npm run dev`, open the harness on `http://127.0.0.1:5173/`, pick Plex.
- **Token-in:** enter your server `baseUrl` (e.g. `https://<id>.plex.direct:32400` or `http://<lan-ip>:32400`) and an `X-Plex-Token`; load a byom-sync playlist and confirm resolve + playback + seek + auto-advance.
- **PIN flow:** leave fields blank, click **Link Plex**, authorize in the popup, confirm server auto-selection (or picker), then playback.
- Confirm CORS behavior for the page origin; note results in `notes.md`.

- [ ] **Step 3: Commit**

```bash
npm run format && npm run lint
git add index.html
git commit -m "feat(plex): dev-harness option (token-in fields + Link Plex)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: README Plex section**

Add a `## Plex` section after `## YouTube`, matching the Subsonic/Spotify sections' depth: config keys (`baseUrl`, `token`, `serverName?`, `product?`); the two auth paths (token-in + PIN "Link Plex"); how to obtain an `X-Plex-Token`; direct-play/codec caveat; CORS/mixed-content note (same family as Subsonic). Add `'plex'` to the `provider` property table row.

- [ ] **Step 2: AGENTS.md provider bullet**

Under "Providers", add a `plex` bullet: HTML5-audio like Subsonic (no engine seam), resolves via `/library/search` → direct-play Part key, reuses `resolutionCache` + stale-recovery; auth is token-in **or** a poll-based PIN device-link (`plex.tv`) with server/connection discovery in `plex/auth.ts` (no `callback.html` — poll-based, unlike Spotify); direct-play only (transcode is a follow-up).

- [ ] **Step 3: Verify + commit**

```bash
npm run format && npm run lint && npm test && npm run build
git add README.md AGENTS.md
git commit -m "docs(plex): document the provider, auth paths, and caveats" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

- [ ] `npm run lint && npm test && npm run build` — all green.
- [ ] Open a PR targeting `main`, summarizing the two auth paths, direct-play MVP, and the manual (live-server) testing still owed.

## Self-review notes (author)

- **Spec coverage:** token-in provider + resolution + audio + cache + stale recovery (T1), PIN core (T2), discovery/selection (T3), provider↔auth UI (T4), harness (T5), docs (T6). All spec sections mapped.
- **Type consistency:** `PlexSession {baseUrl, token}` used throughout; `firstTrackPartKey`, `streamUrl(partKey)`, `resolve→partKey` consistent; `PlexAuthLike.link` returns `PlexSession | {servers}` (union introduced in T3 — T2's test asserts the single-server `PlexSession` case, updated in T3).
- **Known cross-task edit:** T3 changes `link()`'s return type; T3 explicitly updates `types.ts` and the T2 test. Flagged so it isn't a surprise mid-execution.
- **Browser-only reality:** live Plex + plex.tv CORS are verified manually against Les's server (T5), like Subsonic's live server. `firstTrackPartKey` is tolerant of both search response shapes precisely because the exact shape is confirmed live.
