# Spotify Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `spotify` audio provider to byom-player that plays JSPF tracks through Spotify — full tracks via the Web Playback SDK for Premium listeners, with an automatic embed-iframe fallback — using a client-side PKCE login that works on a fully static site.

**Architecture:** A new `SpotifyProvider` implements the existing `AudioProvider` interface. It owns a PKCE popup login (`pkce.ts` + `auth.ts`) and selects between two engines behind a shared `SpotifyEngine` seam: `WebPlaybackEngine` (SDK, Premium) and `EmbedEngine` (iframe, free/preview). Non-Premium accounts surface as a typed error and trigger the embed fallback. All unit-testable logic runs against fake engines/auth; the two real browser-only engines are build-verified and manually tested, following the existing `YtIframeEngine` precedent.

**Tech Stack:** Lit 3, TypeScript, Vite (library mode), Vitest + happy-dom, Spotify Web Playback SDK, Spotify Embed IFrame API, OAuth Authorization Code + PKCE.

## Global Constraints

- No `import 'node:*'` in `src/` — the build's `tsc` has no Node types.
- Real browser-only engines are NOT unit-tested (follow `YtIframeEngine`); they are verified by `npm run build` (tsc typecheck) and manual browser testing.
- Provider files live in `src/providers/spotify/`.
- Verify each task with the repo commands: `npm run lint` (ESLint + Prettier), `npm test` (Vitest), `npm run build` (`tsc --noEmit` + Vite lib build).
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Track resolution reads `track.spotifyUrl` (byom-player internal model), NOT `track.location`.
- Token endpoint: `https://accounts.spotify.com/api/token`. Authorize endpoint: `https://accounts.spotify.com/authorize`. Default scopes: `streaming user-read-email user-read-private`.

## File Structure

```
src/providers/spotify/
  types.ts               # SpotifyConfig, SpotifyEngine, EngineKind, NotPremiumError
  pkce.ts                # randomVerifier, challengeFromVerifier, authorizeUrl
  pkce.test.ts
  auth.ts                # Tokens, TokenStore, exchangeCode, refreshTokens, AuthClient
  auth.test.ts
  SpotifyProvider.ts     # AudioProvider impl: resolution, engine selection, plumbing
  SpotifyProvider.test.ts
  WebPlaybackEngine.ts   # real SDK engine (Premium) — browser-only, build-verified
  EmbedEngine.ts         # real IFrame-embed engine (free/preview) — browser-only, build-verified
src/providers/registry.ts   # MODIFY: add case 'spotify'
index.html                  # MODIFY: add Spotify provider option
public/callback.html        # CREATE: static PKCE popup landing page
README.md                   # MODIFY: Spotify provider + static-host docs
AGENTS.md                   # MODIFY: note the new provider
```

---

## Task 1: PKCE helpers (`pkce.ts`)

**Files:**
- Create: `src/providers/spotify/pkce.ts`
- Create: `src/providers/spotify/types.ts`
- Test: `src/providers/spotify/pkce.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module). Uses global `crypto`, `TextEncoder`, `btoa` (all present in happy-dom / Node webcrypto).
- Produces:
  - `randomVerifier(length?: number): string`
  - `challengeFromVerifier(verifier: string): Promise<string>` (base64url S256)
  - `authorizeUrl(cfg: SpotifyConfig, challenge: string): string`
  - `types.ts` exports `SpotifyConfig` (see code below) — defined here so later tasks import it.

- [ ] **Step 1: Write `types.ts` with the config interface**

```ts
// src/providers/spotify/types.ts
import type { ProviderState } from '../types';

// Non-Premium accounts surface as this typed error so the provider can fall
// back to the embed tier instead of treating it as a generic playback error.
export class NotPremiumError extends Error {
  constructor(message = 'Spotify account is not Premium') {
    super(message);
    this.name = 'NotPremiumError';
  }
}

export type EngineKind = 'sdk' | 'embed';

// A playback engine behind the provider. Mirrors YouTubeEngine so the provider
// is unit-tested against a fake and the real engines stay browser-only.
export interface SpotifyEngine {
  ready(): Promise<void>; // rejects with NotPremiumError when the account can't stream
  attach(element: HTMLElement): void; // embed mounts here; the SDK is headless
  load(uri: string): Promise<void>; // full uri, e.g. 'spotify:track:<id>'
  play(): void;
  pause(): void;
  seek(positionMs: number): void;
  currentTimeMs(): number;
  durationMs(): number;
  onState(cb: (state: ProviderState) => void): void;
  destroy(): void;
}

export interface SpotifyConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  deviceName?: string;
  forceEmbed?: boolean;
  // Test seams (production defaults build the real engines / AuthClient):
  engineFactory?: (kind: EngineKind, getToken: () => Promise<string | null>) => SpotifyEngine;
  auth?: AuthLike;
  debug?: boolean;
}

// The subset of AuthClient the provider depends on (kept small for test fakes).
export interface AuthLike {
  hasToken(): boolean;
  getValidToken(): Promise<string | null>;
  login(): Promise<string>;
}

export const DEFAULT_SCOPES = ['streaming', 'user-read-email', 'user-read-private'];
```

- [ ] **Step 2: Write the failing test**

```ts
// src/providers/spotify/pkce.test.ts
import { describe, it, expect } from 'vitest';
import { randomVerifier, challengeFromVerifier, authorizeUrl } from './pkce';

describe('pkce', () => {
  it('generates a verifier of the requested length from the unreserved set', () => {
    const v = randomVerifier(64);
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9._~-]+$/);
    expect(randomVerifier(64)).not.toBe(v); // random
  });

  it('derives a base64url S256 challenge (no padding, url-safe)', async () => {
    // Known RFC 7636 vector: verifier -> challenge
    const c = await challengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(c).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(c).not.toContain('=');
    expect(c).not.toContain('+');
    expect(c).not.toContain('/');
  });

  it('builds the authorize URL with all PKCE params', () => {
    const url = new URL(
      authorizeUrl(
        { clientId: 'CID', redirectUri: 'https://x.test/callback.html' },
        'CHAL',
      ),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('CID');
    expect(url.searchParams.get('redirect_uri')).toBe('https://x.test/callback.html');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('CHAL');
    expect(url.searchParams.get('scope')).toBe('streaming user-read-email user-read-private');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/providers/spotify/pkce.test.ts`
Expected: FAIL — cannot find module `./pkce`.

- [ ] **Step 4: Implement `pkce.ts`**

```ts
// src/providers/spotify/pkce.ts
import { type SpotifyConfig, DEFAULT_SCOPES } from './types';

const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';
const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

// A cryptographically-random PKCE code_verifier from the RFC 7636 unreserved set.
export function randomVerifier(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += UNRESERVED[b % UNRESERVED.length];
  return out;
}

// S256 challenge = base64url( SHA-256(verifier) ), no padding.
export async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authorizeUrl(cfg: SpotifyConfig, challenge: string): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: (cfg.scopes ?? DEFAULT_SCOPES).join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString();
  return url.toString();
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/providers/spotify/pkce.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/providers/spotify/types.ts src/providers/spotify/pkce.ts src/providers/spotify/pkce.test.ts
git commit -m "feat(spotify): PKCE verifier/challenge + authorize URL" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Token exchange, storage, and popup login (`auth.ts`)

**Files:**
- Create: `src/providers/spotify/auth.ts`
- Test: `src/providers/spotify/auth.test.ts`

**Interfaces:**
- Consumes: `pkce.ts` (`randomVerifier`, `challengeFromVerifier`, `authorizeUrl`); `types.ts` (`SpotifyConfig`, `AuthLike`).
- Produces:
  - `interface Tokens { accessToken: string; refreshToken: string; expiresAt: number }`
  - `class TokenStore { constructor(clientId: string, storage?: Storage); load(): Tokens | null; save(t: Tokens): void; clear(): void }`
  - `exchangeCode(cfg, code, verifier, now?): Promise<Tokens>`
  - `refreshTokens(cfg, refreshToken, now?): Promise<Tokens>`
  - `class AuthClient implements AuthLike` with `constructor(cfg, deps?: { store?; win?; now?() })`, `hasToken()`, `getValidToken()`, `login()`.
- The callback page sends `window.location.search` (e.g. `"?code=abc"`) via `postMessage`; `AuthClient` parses it with `URLSearchParams`.

- [ ] **Step 1: Write the failing test**

```ts
// src/providers/spotify/auth.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TokenStore, exchangeCode, refreshTokens, AuthClient } from './auth';
import type { SpotifyConfig } from './types';

const CFG: SpotifyConfig = { clientId: 'CID', redirectUri: 'https://x.test/callback.html' };

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

class FakeStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

afterEach(() => vi.restoreAllMocks());

describe('TokenStore', () => {
  it('round-trips and clears, scoped by clientId', () => {
    const s = new FakeStorage();
    const store = new TokenStore('CID', s);
    expect(store.load()).toBeNull();
    store.save({ accessToken: 'a', refreshToken: 'r', expiresAt: 123 });
    expect(store.load()).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: 123 });
    expect(new TokenStore('OTHER', s).load()).toBeNull(); // scoped
    store.clear();
    expect(store.load()).toBeNull();
  });
});

describe('exchangeCode / refreshTokens', () => {
  it('exchanges an auth code for tokens with the PKCE params', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okJson({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }));
    const t = await exchangeCode(CFG, 'CODE', 'VERIFIER', () => 1000);
    expect(t).toEqual({ accessToken: 'AT', refreshToken: 'RT', expiresAt: 1000 + 3600_000 });
    const body = fetchMock.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('CODE');
    expect(body.get('code_verifier')).toBe('VERIFIER');
    expect(body.get('client_id')).toBe('CID');
  });

  it('keeps the prior refresh token when refresh omits one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ access_token: 'AT2', expires_in: 3600 }),
    );
    const t = await refreshTokens(CFG, 'OLD_RT', () => 0);
    expect(t.accessToken).toBe('AT2');
    expect(t.refreshToken).toBe('OLD_RT'); // preserved
  });

  it('throws on a non-ok token response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 400 } as Response);
    await expect(exchangeCode(CFG, 'C', 'V')).rejects.toThrow();
  });
});

describe('AuthClient.getValidToken', () => {
  it('returns null with no stored token', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    const auth = new AuthClient(CFG, { store });
    expect(await auth.getValidToken()).toBeNull();
    expect(auth.hasToken()).toBe(false);
  });

  it('returns the cached token when unexpired', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    store.save({ accessToken: 'AT', refreshToken: 'RT', expiresAt: 10_000 });
    const auth = new AuthClient(CFG, { store, now: () => 0 });
    expect(await auth.getValidToken()).toBe('AT');
  });

  it('refreshes an expired token and persists the result', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    store.save({ accessToken: 'OLD', refreshToken: 'RT', expiresAt: 0 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ access_token: 'NEW', refresh_token: 'RT2', expires_in: 3600 }),
    );
    const auth = new AuthClient(CFG, { store, now: () => 1000 });
    expect(await auth.getValidToken()).toBe('NEW');
    expect(store.load()!.accessToken).toBe('NEW');
    expect(store.load()!.refreshToken).toBe('RT2');
  });
});

describe('AuthClient.login (popup + postMessage)', () => {
  it('opens a popup, receives the code, exchanges it, and stores tokens', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    let messageHandler: ((ev: MessageEvent) => void) | null = null;
    const popup = { closed: false, close: vi.fn() };
    const win = {
      open: vi.fn(() => popup),
      addEventListener: vi.fn((_t: string, h: (ev: MessageEvent) => void) => {
        messageHandler = h;
      }),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }),
    );

    const auth = new AuthClient(CFG, { store, win, now: () => 0 });
    const p = auth.login();
    await vi.waitFor(() => expect(messageHandler).not.toBeNull());

    // wrong origin is ignored
    messageHandler!({ origin: 'https://evil.test', data: '?code=NOPE' } as MessageEvent);
    // correct origin delivers the code
    messageHandler!({ origin: 'https://x.test', data: '?code=THECODE' } as MessageEvent);

    expect(await p).toBe('AT');
    expect(store.load()!.accessToken).toBe('AT');
    expect(win.open).toHaveBeenCalled();
  });

  it('rejects when the popup is blocked', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    const win = { open: vi.fn(() => null), addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as Window;
    const auth = new AuthClient(CFG, { store, win });
    await expect(auth.login()).rejects.toThrow(/popup/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/providers/spotify/auth.test.ts`
Expected: FAIL — cannot find module `./auth`.

- [ ] **Step 3: Implement `auth.ts`**

```ts
// src/providers/spotify/auth.ts
import { randomVerifier, challengeFromVerifier, authorizeUrl } from './pkce';
import type { SpotifyConfig, AuthLike } from './types';

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const EXPIRY_SKEW_MS = 60_000; // refresh a minute early

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// localStorage-backed token cache, scoped by clientId.
export class TokenStore {
  constructor(
    private readonly clientId: string,
    private readonly storage: Storage = localStorage,
  ) {}
  private key(): string {
    return `byom-spotify:${this.clientId}`;
  }
  load(): Tokens | null {
    const raw = this.storage.getItem(this.key());
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Tokens;
    } catch {
      return null;
    }
  }
  save(t: Tokens): void {
    this.storage.setItem(this.key(), JSON.stringify(t));
  }
  clear(): void {
    this.storage.removeItem(this.key());
  }
}

type Clock = () => number;

async function postToken(body: URLSearchParams, now: Clock, priorRefresh?: string): Promise<Tokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token endpoint returned ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? priorRefresh ?? '',
    expiresAt: now() + data.expires_in * 1000,
  };
}

export function exchangeCode(
  cfg: SpotifyConfig,
  code: string,
  verifier: string,
  now: Clock = Date.now,
): Promise<Tokens> {
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      code_verifier: verifier,
    }),
    now,
  );
}

export function refreshTokens(
  cfg: SpotifyConfig,
  refreshToken: string,
  now: Clock = Date.now,
): Promise<Tokens> {
  return postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: cfg.clientId,
    }),
    now,
    refreshToken,
  );
}

export interface AuthDeps {
  store?: TokenStore;
  win?: Window;
  now?: Clock;
}

// Owns the client-side PKCE flow and the token cache.
export class AuthClient implements AuthLike {
  private readonly store: TokenStore;
  private readonly win: Window;
  private readonly now: Clock;

  constructor(
    private readonly cfg: SpotifyConfig,
    deps: AuthDeps = {},
  ) {
    this.store = deps.store ?? new TokenStore(cfg.clientId);
    this.win = deps.win ?? window;
    this.now = deps.now ?? Date.now;
  }

  hasToken(): boolean {
    return this.store.load() !== null;
  }

  async getValidToken(): Promise<string | null> {
    const t = this.store.load();
    if (!t) return null;
    if (t.expiresAt - EXPIRY_SKEW_MS > this.now()) return t.accessToken;
    const refreshed = await refreshTokens(this.cfg, t.refreshToken, this.now);
    this.store.save(refreshed);
    return refreshed.accessToken;
  }

  // Opens the authorize popup, awaits the code via postMessage, exchanges it.
  async login(): Promise<string> {
    const verifier = randomVerifier();
    const challenge = await challengeFromVerifier(verifier);
    const popup = this.win.open(authorizeUrl(this.cfg, challenge), 'spotify-login', 'width=480,height=720');
    if (!popup) throw new Error('Spotify login popup was blocked');
    const code = await this.awaitCode(popup);
    const tokens = await exchangeCode(this.cfg, code, verifier, this.now);
    this.store.save(tokens);
    return tokens.accessToken;
  }

  private awaitCode(popup: Window): Promise<string> {
    const expectedOrigin = new URL(this.cfg.redirectUri).origin;
    return new Promise<string>((resolve, reject) => {
      const handler = (ev: MessageEvent) => {
        if (ev.origin !== expectedOrigin || typeof ev.data !== 'string') return;
        const params = new URLSearchParams(ev.data);
        const code = params.get('code');
        const err = params.get('error');
        if (!code && !err) return;
        cleanup();
        if (err) reject(new Error(`Spotify authorization failed: ${err}`));
        else resolve(code!);
      };
      const timer = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error('Spotify login popup was closed'));
        }
      }, 500);
      const cleanup = () => {
        this.win.removeEventListener('message', handler);
        clearInterval(timer);
        try {
          popup.close();
        } catch {
          /* ignore */
        }
      };
      this.win.addEventListener('message', handler);
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/providers/spotify/auth.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/providers/spotify/auth.ts src/providers/spotify/auth.test.ts
git commit -m "feat(spotify): PKCE token exchange, storage, and popup login" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: SpotifyProvider — resolution & playback plumbing

**Files:**
- Create: `src/providers/spotify/SpotifyProvider.ts`
- Test: `src/providers/spotify/SpotifyProvider.test.ts`

**Interfaces:**
- Consumes: `types.ts` (`SpotifyConfig`, `SpotifyEngine`, `EngineKind`, `NotPremiumError`, `AuthLike`); `auth.ts` (`AuthClient`); `../types` (`AudioProvider`, `ProviderState`, `AvailabilityStatus`); `../../types` (`Track`).
- Produces:
  - `parseSpotifyId(url?: string): string | null`
  - `class SpotifyProvider implements AudioProvider` with `name = 'spotify'`, `attach`, `initialize`, `load`, `play`, `pause`, `seek`, `onStateChange`, `onProgress`, `checkAvailability`, `dispose`.

This task builds resolution, engine plumbing (via an injected fake engine), the progress ticker, and `checkAvailability`. Engine SELECTION/tiering + the connect button come in Task 4.

- [ ] **Step 1: Write the failing test**

```ts
// src/providers/spotify/SpotifyProvider.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyProvider, parseSpotifyId } from './SpotifyProvider';
import type { SpotifyEngine, EngineKind, AuthLike } from './types';
import type { ProviderState } from '../types';

class FakeEngine implements SpotifyEngine {
  kind: EngineKind;
  attached: HTMLElement | null = null;
  loaded: string | null = null;
  played = 0;
  paused = 0;
  seekedMs: number | null = null;
  destroyed = false;
  posMs = 0;
  durMs = 0;
  readyImpl: () => Promise<void> = async () => {};
  private stateCb: (s: ProviderState) => void = () => {};
  constructor(kind: EngineKind) {
    this.kind = kind;
  }
  ready() {
    return this.readyImpl();
  }
  attach(el: HTMLElement) {
    this.attached = el;
  }
  async load(uri: string) {
    this.loaded = uri;
  }
  play() {
    this.played += 1;
  }
  pause() {
    this.paused += 1;
  }
  seek(ms: number) {
    this.seekedMs = ms;
  }
  currentTimeMs() {
    return this.posMs;
  }
  durationMs() {
    return this.durMs;
  }
  onState(cb: (s: ProviderState) => void) {
    this.stateCb = cb;
  }
  destroy() {
    this.destroyed = true;
  }
  emit(s: ProviderState) {
    this.stateCb(s);
  }
}

// Auth that already has a valid token (SDK path taken without a popup).
const readyAuth: AuthLike = {
  hasToken: () => true,
  getValidToken: async () => 'TOKEN',
  login: async () => 'TOKEN',
};

function makeProvider(engines: Record<EngineKind, FakeEngine>, auth: AuthLike = readyAuth) {
  return new SpotifyProvider({
    clientId: 'CID',
    redirectUri: 'https://x.test/callback.html',
    auth,
    engineFactory: (kind: EngineKind) => engines[kind],
  });
}

describe('parseSpotifyId', () => {
  it('parses open.spotify.com URLs and spotify: URIs, rejects others', () => {
    expect(parseSpotifyId('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(
      '4iV5W9uYEdYUVa79Axb7Rh',
    );
    expect(parseSpotifyId('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=abc')).toBe(
      '4iV5W9uYEdYUVa79Axb7Rh',
    );
    expect(parseSpotifyId('spotify:track:4iV5W9uYEdYUVa79Axb7Rh')).toBe('4iV5W9uYEdYUVa79Axb7Rh');
    expect(parseSpotifyId('https://example.com/x')).toBeNull();
    expect(parseSpotifyId(undefined)).toBeNull();
  });
});

describe('SpotifyProvider resolution', () => {
  it('loads the spotify: uri for a track with a spotifyUrl', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    const el = document.createElement('div');
    p.attach(el);
    await p.initialize();
    await p.load({ title: 'T', artist: 'A', spotifyUrl: 'https://open.spotify.com/track/ABC' });
    expect(engines.sdk.loaded).toBe('spotify:track:ABC');
  });

  it('emits unavailable when the track has no Spotify URL', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    const states: ProviderState[] = [];
    p.onStateChange((s) => states.push(s));
    p.attach(document.createElement('div'));
    await p.initialize();
    await p.load({ title: 'T', artist: 'A' });
    expect(states.at(-1)).toBe('unavailable');
    expect(engines.sdk.loaded).toBeNull();
  });

  it('checkAvailability is a network-less URL parse', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    expect(await p.checkAvailability({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:X' })).toBe(
      'available',
    );
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unavailable');
  });
});

describe('SpotifyProvider playback plumbing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delegates play/pause/seek and forwards state + ticked progress', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    const states: ProviderState[] = [];
    const progress: [number, number][] = [];
    p.onStateChange((s) => states.push(s));
    p.onProgress((pos, dur) => progress.push([pos, dur]));
    p.attach(document.createElement('div'));
    await p.initialize();

    await p.play();
    expect(engines.sdk.played).toBe(1);
    engines.sdk.posMs = 5000;
    engines.sdk.durMs = 180000;
    engines.sdk.emit('playing');
    expect(states.at(-1)).toBe('playing');
    vi.advanceTimersByTime(250);
    expect(progress.at(-1)).toEqual([5000, 180000]);

    p.seek(30000);
    expect(engines.sdk.seekedMs).toBe(30000);
    p.pause();
    expect(engines.sdk.paused).toBe(1);

    engines.sdk.emit('paused'); // ticker stops
    p.dispose();
    expect(engines.sdk.destroyed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/providers/spotify/SpotifyProvider.test.ts`
Expected: FAIL — cannot find module `./SpotifyProvider`.

- [ ] **Step 3: Implement `SpotifyProvider.ts`**

```ts
// src/providers/spotify/SpotifyProvider.ts
import type { Track } from '../../types';
import type { AudioProvider, ProviderState, AvailabilityStatus } from '../types';
import { AuthClient } from './auth';
import { NotPremiumError, type SpotifyConfig, type SpotifyEngine, type EngineKind, type AuthLike } from './types';

const PROGRESS_TICK_MS = 250;

// Parse a Spotify track id from an open.spotify.com URL or a spotify: URI.
export function parseSpotifyId(url?: string): string | null {
  if (!url) return null;
  const uri = url.match(/^spotify:track:([A-Za-z0-9]+)/);
  if (uri) return uri[1];
  const web = url.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  if (web) return web[1];
  return null;
}

// Plays JSPF tracks through Spotify. Resolution parses the track's spotifyUrl;
// playback goes through a WebPlaybackEngine (Premium) or EmbedEngine fallback.
export class SpotifyProvider implements AudioProvider {
  name = 'spotify';

  private readonly cfg: SpotifyConfig;
  private readonly auth: AuthLike;
  private engine: SpotifyEngine | null = null;
  private target: HTMLElement | null = null;
  private stateCallback: (s: ProviderState) => void = () => {};
  private progressCallback: (pos: number, dur: number) => void = () => {};
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(config: Record<string, unknown>) {
    this.cfg = config as unknown as SpotifyConfig;
    this.auth = this.cfg.auth ?? new AuthClient(this.cfg);
  }

  attach(element: HTMLElement): void {
    this.target = element;
  }

  // Engine selection/tiering is added in Task 4; here we build the SDK engine.
  async initialize(): Promise<void> {
    await this.useEngine('sdk');
    this.stateCallback('ready');
  }

  async load(track: Track): Promise<void> {
    const id = parseSpotifyId(track.spotifyUrl);
    if (!id) {
      this.log('no spotify url', track.artist, '-', track.title);
      this.stateCallback('unavailable');
      return;
    }
    await this.engine?.load(`spotify:track:${id}`);
  }

  async play(): Promise<void> {
    this.engine?.play();
  }
  pause(): void {
    this.engine?.pause();
  }
  seek(positionMs: number): void {
    this.engine?.seek(positionMs);
  }
  onStateChange(cb: (s: ProviderState) => void): void {
    this.stateCallback = cb;
  }
  onProgress(cb: (pos: number, dur: number) => void): void {
    this.progressCallback = cb;
  }

  async checkAvailability(track: Track): Promise<AvailabilityStatus> {
    return parseSpotifyId(track.spotifyUrl) ? 'available' : 'unavailable';
  }

  dispose(): void {
    this.stopTicker();
    this.engine?.destroy();
    this.engine = null;
  }

  // --- internals ---

  protected makeEngine(kind: EngineKind): SpotifyEngine {
    if (this.cfg.engineFactory) return this.cfg.engineFactory(kind, () => this.auth.getValidToken());
    // Real engines are wired in Tasks 5-6; until then only injected engines run.
    throw new Error(`SpotifyProvider: no engine factory for '${kind}'`);
  }

  protected async useEngine(kind: EngineKind): Promise<void> {
    const engine = this.makeEngine(kind);
    engine.onState((s) => this.handleState(s));
    if (this.target) engine.attach(this.target);
    this.engine = engine;
    await engine.ready();
  }

  private handleState(s: ProviderState): void {
    this.stateCallback(s);
    if (s === 'playing') this.startTicker();
    else this.stopTicker();
  }

  private startTicker(): void {
    this.stopTicker();
    this.tick();
    this.ticker = setInterval(() => this.tick(), PROGRESS_TICK_MS);
  }
  private tick(): void {
    if (this.engine) this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs());
  }
  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
  private log(...args: unknown[]): void {
    if (this.cfg.debug) console.debug('[byom-player:spotify]', ...args);
  }
}
```

Note: `NotPremiumError` is imported for use in Task 4; if the linter flags it as unused before Task 4, add it in Task 4 instead. To keep this task lint-clean, import only what is used now — remove `NotPremiumError` and `EngineKind`/`AuthLike` from the import if unused, and re-add in Task 4. (Simplest: keep `type EngineKind` and `type AuthLike` since they ARE used above; drop `NotPremiumError` here and add it in Task 4.)

- [ ] **Step 4: Fix the import to only what's used, then run the test**

Ensure the import line reads:
```ts
import { type SpotifyConfig, type SpotifyEngine, type EngineKind, type AuthLike } from './types';
```

Run: `npx vitest run src/providers/spotify/SpotifyProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/providers/spotify/SpotifyProvider.ts src/providers/spotify/SpotifyProvider.test.ts
git commit -m "feat(spotify): provider resolution, playback plumbing, availability" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Engine selection, tiering & the connect button

**Files:**
- Modify: `src/providers/spotify/SpotifyProvider.ts`
- Modify: `src/providers/spotify/SpotifyProvider.test.ts` (add cases)
- Modify: `src/providers/registry.ts:15` (add `case 'spotify'`)

**Interfaces:**
- Consumes: everything from Task 3 + `NotPremiumError`.
- Produces: an `initialize()` that (a) uses the embed engine when `forceEmbed`; (b) tries the SDK when a token exists and falls back to embed on `NotPremiumError`; (c) renders a "Connect Spotify" button into `attach`'s element when there's no token, running `auth.login()` on click.

- [ ] **Step 1: Add failing tests for tiering + connect**

Append to `SpotifyProvider.test.ts`:
```ts
describe('SpotifyProvider engine selection', () => {
  it('uses the embed engine when forceEmbed is set', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = new SpotifyProvider({
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
      auth: readyAuth,
      forceEmbed: true,
      engineFactory: (kind: EngineKind) => engines[kind],
    });
    p.attach(document.createElement('div'));
    await p.initialize();
    await p.load({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:Z' });
    expect(engines.embed.loaded).toBe('spotify:track:Z');
    expect(engines.sdk.loaded).toBeNull();
  });

  it('falls back to embed when the SDK reports NotPremiumError', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    engines.sdk.readyImpl = async () => {
      throw new NotPremiumError();
    };
    const p = new SpotifyProvider({
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
      auth: readyAuth,
      engineFactory: (kind: EngineKind) => engines[kind],
    });
    p.attach(document.createElement('div'));
    await p.initialize();
    await p.load({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:Z' });
    expect(engines.embed.loaded).toBe('spotify:track:Z');
  });

  it('renders a Connect button when there is no token, then connects on click', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    let loggedIn = false;
    const auth: AuthLike = {
      hasToken: () => loggedIn,
      getValidToken: async () => (loggedIn ? 'TOKEN' : null),
      login: async () => {
        loggedIn = true;
        return 'TOKEN';
      },
    };
    const el = document.createElement('div');
    const p = new SpotifyProvider({
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
      auth,
      engineFactory: (kind: EngineKind) => engines[kind],
    });
    p.attach(el);
    await p.initialize();

    const btn = el.querySelector('button');
    expect(btn).not.toBeNull();
    expect(engines.sdk.loaded).toBeNull(); // not connected yet

    btn!.click();
    await vi.waitFor(() => expect(engines.sdk.attached).toBe(el));
    await p.load({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:Z' });
    expect(engines.sdk.loaded).toBe('spotify:track:Z');
  });
});
```

Also add `NotPremiumError` to the test's imports from `./types`.

- [ ] **Step 2: Run to verify new tests fail**

Run: `npx vitest run src/providers/spotify/SpotifyProvider.test.ts`
Expected: FAIL — `forceEmbed`/fallback/connect behaviors not implemented (SDK still chosen unconditionally).

- [ ] **Step 3: Replace `initialize()` and add selection logic**

In `SpotifyProvider.ts`, add `NotPremiumError` to the import from `./types`, then replace the `initialize()` method and add the helpers below:

```ts
  async initialize(): Promise<void> {
    if (this.cfg.forceEmbed) {
      await this.useEngine('embed');
      this.stateCallback('ready');
      return;
    }
    const token = await this.auth.getValidToken();
    if (!token) {
      this.renderConnect();
      this.stateCallback('ready');
      return;
    }
    await this.connectWithFallback();
  }

  private async connectWithFallback(): Promise<void> {
    try {
      await this.useEngine('sdk');
    } catch (err) {
      if (err instanceof NotPremiumError) {
        this.log('account not premium — falling back to embed');
        await this.useEngine('embed');
      } else {
        this.log('sdk connect error', err);
        this.stateCallback('error');
        return;
      }
    }
    this.stateCallback('ready');
  }

  private renderConnect(): void {
    if (!this.target) return;
    this.target.replaceChildren();
    const btn = this.target.ownerDocument.createElement('button');
    btn.textContent = 'Connect Spotify';
    btn.className = 'byom-spotify-connect';
    btn.addEventListener('click', () => {
      void this.handleConnectClick(btn);
    });
    this.target.appendChild(btn);
  }

  private async handleConnectClick(btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    try {
      await this.auth.login();
      this.target?.replaceChildren(); // clear the button before mounting an engine
      await this.connectWithFallback();
    } catch (err) {
      this.log('login failed', err);
      btn.disabled = false;
      this.stateCallback('error');
    }
  }
```

- [ ] **Step 4: Run the provider tests**

Run: `npx vitest run src/providers/spotify/SpotifyProvider.test.ts`
Expected: PASS (all resolution, plumbing, and selection cases).

- [ ] **Step 5: Register the provider**

Edit `src/providers/registry.ts`: add the import and case.
```ts
import { SpotifyProvider } from './spotify/SpotifyProvider';
```
```ts
    case 'spotify':
      return new SpotifyProvider(config);
```

- [ ] **Step 6: Add a registry test**

Append to the existing registry test (or create `src/providers/registry.test.ts` if none exists — check first with `ls src/providers/registry.test.ts`). If creating:
```ts
// src/providers/registry.test.ts
import { describe, it, expect } from 'vitest';
import { createProvider } from './registry';

describe('createProvider', () => {
  it('creates a spotify provider', () => {
    const p = createProvider('spotify', {
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
    });
    expect(p.name).toBe('spotify');
  });
  it('throws on an unknown provider', () => {
    expect(() => createProvider('nope', {})).toThrow();
  });
});
```

- [ ] **Step 7: Full verify + commit**

```bash
npm run lint && npm test && npm run build
git add src/providers/spotify/SpotifyProvider.ts src/providers/spotify/SpotifyProvider.test.ts src/providers/registry.ts src/providers/registry.test.ts
git commit -m "feat(spotify): engine tiering, embed fallback, connect button, registry" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: WebPlaybackEngine (real SDK — browser-only)

**Files:**
- Create: `src/providers/spotify/WebPlaybackEngine.ts`
- Modify: `src/providers/spotify/SpotifyProvider.ts` (wire the real factory)

**Interfaces:**
- Consumes: `types.ts` (`SpotifyEngine`, `NotPremiumError`, `SpotifyConfig`); `../types` (`ProviderState`).
- Produces: `class WebPlaybackEngine implements SpotifyEngine`, constructed with `(cfg: SpotifyConfig, getToken: () => Promise<string | null>)`.

Not unit-tested (browser-only, like `YtIframeEngine`). Verified by `npm run build` (tsc) and manual testing.

- [ ] **Step 1: Implement `WebPlaybackEngine.ts`**

```ts
// src/providers/spotify/WebPlaybackEngine.ts
// Real Spotify Web Playback SDK engine (Premium). Browser-only; not unit-tested.
import type { ProviderState } from '../types';
import { NotPremiumError, type SpotifyConfig, type SpotifyEngine } from './types';

declare global {
  interface Window {
    Spotify?: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
const PLAY_ENDPOINT = 'https://api.spotify.com/v1/me/player/play';

let sdkReady: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (sdkReady) return sdkReady;
  sdkReady = new Promise<void>((resolve) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = SDK_SRC;
    document.head.appendChild(tag);
  });
  return sdkReady;
}

export class WebPlaybackEngine implements SpotifyEngine {
  private player: any = null;
  private deviceId: string | null = null;
  private lastState: any = null;
  private stateCb: (s: ProviderState) => void = () => {};

  constructor(
    private readonly cfg: SpotifyConfig,
    private readonly getToken: () => Promise<string | null>,
  ) {}

  // Headless — no visible surface.
  attach(): void {}

  async ready(): Promise<void> {
    await loadSdk();
    this.player = new window.Spotify.Player({
      name: this.cfg.deviceName ?? 'byom-player',
      getOAuthToken: (cb: (t: string) => void) => {
        void this.getToken().then((t) => {
          if (t) cb(t);
        });
      },
      volume: 1.0,
    });

    this.player.addListener('player_state_changed', (s: any) => {
      this.lastState = s;
      if (s) this.stateCb(s.paused ? 'paused' : 'playing');
    });

    await new Promise<void>((resolve, reject) => {
      this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
        this.deviceId = device_id;
        resolve();
      });
      this.player.addListener('account_error', ({ message }: { message: string }) =>
        reject(new NotPremiumError(message)),
      );
      this.player.addListener('authentication_error', ({ message }: { message: string }) =>
        reject(new Error(`Spotify auth error: ${message}`)),
      );
      this.player.addListener('initialization_error', ({ message }: { message: string }) =>
        reject(new Error(`Spotify init error: ${message}`)),
      );
      this.player.connect();
    });
  }

  async load(uri: string): Promise<void> {
    const token = await this.getToken();
    if (!token || !this.deviceId) throw new Error('Spotify device not ready');
    const res = await fetch(`${PLAY_ENDPOINT}?device_id=${encodeURIComponent(this.deviceId)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] }),
    });
    if (!res.ok && res.status !== 202 && res.status !== 204) {
      this.stateCb('error');
    }
  }

  play(): void {
    void this.player?.resume();
  }
  pause(): void {
    void this.player?.pause();
  }
  seek(positionMs: number): void {
    void this.player?.seek(positionMs);
  }
  currentTimeMs(): number {
    return this.lastState?.position ?? 0;
  }
  durationMs(): number {
    return this.lastState?.duration ?? 0;
  }
  onState(cb: (s: ProviderState) => void): void {
    this.stateCb = cb;
  }
  destroy(): void {
    this.player?.disconnect?.();
    this.player = null;
  }
}
```

- [ ] **Step 2: Wire the real factory in `SpotifyProvider.makeEngine`**

Replace the `makeEngine` body:
```ts
  protected makeEngine(kind: EngineKind): SpotifyEngine {
    if (this.cfg.engineFactory) return this.cfg.engineFactory(kind, () => this.auth.getValidToken());
    const getToken = () => this.auth.getValidToken();
    if (kind === 'sdk') return new WebPlaybackEngine(this.cfg, getToken);
    return new EmbedEngine(this.cfg); // added in Task 6
  }
```
Add imports at the top of `SpotifyProvider.ts`:
```ts
import { WebPlaybackEngine } from './WebPlaybackEngine';
```
(The `EmbedEngine` import is added in Task 6; to keep this task building, temporarily throw for the embed branch instead:)
```ts
    if (kind === 'sdk') return new WebPlaybackEngine(this.cfg, getToken);
    throw new Error('EmbedEngine not yet implemented'); // replaced in Task 6
```

- [ ] **Step 3: Build to typecheck the real engine**

Run: `npm run build`
Expected: PASS (tsc clean, Vite lib build succeeds).

- [ ] **Step 4: Run the full test suite (unchanged — injected fakes still used)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers/spotify/WebPlaybackEngine.ts src/providers/spotify/SpotifyProvider.ts
git commit -m "feat(spotify): real Web Playback SDK engine (Premium, browser-only)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: EmbedEngine (real iframe — browser-only)

**Files:**
- Create: `src/providers/spotify/EmbedEngine.ts`
- Modify: `src/providers/spotify/SpotifyProvider.ts` (replace the temporary throw)

**Interfaces:**
- Consumes: `types.ts` (`SpotifyEngine`, `SpotifyConfig`); `../types` (`ProviderState`).
- Produces: `class EmbedEngine implements SpotifyEngine`, constructed with `(cfg: SpotifyConfig)`.

Not unit-tested (browser-only). Verified by `npm run build` + manual testing.

- [ ] **Step 1: Implement `EmbedEngine.ts`**

```ts
// src/providers/spotify/EmbedEngine.ts
// Real Spotify embed IFrame engine (free/preview tier). Browser-only; not unit-tested.
import type { ProviderState } from '../types';
import type { SpotifyConfig, SpotifyEngine } from './types';

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void;
  }
}
interface SpotifyIFrameApi {
  createController(
    el: HTMLElement,
    opts: { uri?: string; width?: string | number; height?: string | number },
    cb: (controller: EmbedController) => void,
  ): void;
}
interface EmbedController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  destroy(): void;
  addListener(event: string, cb: (e: any) => void): void;
}

const IFRAME_API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
const END_EPSILON_MS = 750;

let apiReady: Promise<SpotifyIFrameApi> | null = null;
function loadIframeApi(): Promise<SpotifyIFrameApi> {
  if (apiReady) return apiReady;
  apiReady = new Promise<SpotifyIFrameApi>((resolve) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    const tag = document.createElement('script');
    tag.src = IFRAME_API_SRC;
    document.head.appendChild(tag);
  });
  return apiReady;
}

export class EmbedEngine implements SpotifyEngine {
  private controller: EmbedController | null = null;
  private target: HTMLElement | null = null;
  private posMs = 0;
  private durMs = 0;
  private stateCb: (s: ProviderState) => void = () => {};

  constructor(private readonly _cfg: SpotifyConfig) {}

  attach(element: HTMLElement): void {
    this.target = element;
  }

  async ready(): Promise<void> {
    const api = await loadIframeApi();
    const host = this.target ?? document.body;
    const holder = document.createElement('div');
    host.appendChild(holder);
    await new Promise<void>((resolve) => {
      api.createController(holder, { width: '100%', height: 152 }, (controller) => {
        this.controller = controller;
        controller.addListener('ready', () => resolve());
        controller.addListener('playback_update', (e: { data: { isPaused: boolean; position: number; duration: number } }) => {
          this.posMs = e.data.position;
          this.durMs = e.data.duration;
          if (this.durMs > 0 && this.posMs >= this.durMs - END_EPSILON_MS) {
            this.stateCb('ended');
          } else {
            this.stateCb(e.data.isPaused ? 'paused' : 'playing');
          }
        });
      });
    });
  }

  async load(uri: string): Promise<void> {
    this.controller?.loadUri(uri);
  }
  play(): void {
    this.controller?.resume();
  }
  pause(): void {
    this.controller?.pause();
  }
  seek(positionMs: number): void {
    this.controller?.seek(positionMs / 1000);
  }
  currentTimeMs(): number {
    return this.posMs;
  }
  durationMs(): number {
    return this.durMs;
  }
  onState(cb: (s: ProviderState) => void): void {
    this.stateCb = cb;
  }
  destroy(): void {
    this.controller?.destroy();
    this.controller = null;
  }
}
```

- [ ] **Step 2: Replace the temporary throw in `SpotifyProvider.makeEngine`**

```ts
    if (kind === 'sdk') return new WebPlaybackEngine(this.cfg, getToken);
    return new EmbedEngine(this.cfg);
```
Add the import:
```ts
import { EmbedEngine } from './EmbedEngine';
```

- [ ] **Step 3: Build + test**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/providers/spotify/EmbedEngine.ts src/providers/spotify/SpotifyProvider.ts
git commit -m "feat(spotify): real embed iframe engine (free/preview, browser-only)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Dev harness + static callback page

**Files:**
- Create: `public/callback.html`
- Modify: `index.html` (add a Spotify provider option)

**Interfaces:**
- Consumes: nothing (HTML/JS glue). The callback posts `window.location.search` to `window.opener`.

- [ ] **Step 1: Create `public/callback.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Spotify login</title>
  </head>
  <body>
    <p>Completing Spotify login…</p>
    <script>
      // Static PKCE popup landing page. Sends the ?code= (or ?error=) back to
      // the opener, which completes the token exchange, then closes.
      if (window.opener) {
        window.opener.postMessage(window.location.search, window.location.origin);
        window.close();
      } else {
        document.body.textContent = 'Please return to the player tab.';
      }
    </script>
  </body>
</html>
```

- [ ] **Step 2: Add a Spotify option to `index.html`**

Read the current provider-selection block in `index.html` first (`grep -n "provider" index.html`), then add a Spotify choice consistent with the existing options — inputs for `clientId` and `redirectUri` (default the redirect to `${location.origin}/callback.html`), wiring them into the config object passed to the player exactly as the YouTube option does. Match the existing markup/JS style in the file rather than inventing a new pattern.

- [ ] **Step 3: Manual smoke (documented, not automated)**

Run: `npm run dev`, open the harness, pick Spotify, enter a real `clientId` (with `http://localhost:5173/callback.html` — or the shown dev origin — registered as a redirect URI in the Spotify dashboard), click "Connect Spotify", authenticate in the popup. With a Premium account, confirm full-track playback + seek; with a free account, confirm the embed appears and previews play.

Note in `notes.md` that this step needs a real Spotify app + account and is manual.

- [ ] **Step 4: Commit**

```bash
git add public/callback.html index.html
git commit -m "feat(spotify): dev-harness option + static PKCE callback page" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Document the provider in `README.md`**

Add a Spotify subsection under the providers documentation covering: config keys (`clientId`, `redirectUri`, `scopes?`, `deviceName?`, `forceEmbed?`); Premium-vs-embed tiers; the one-time Spotify dashboard setup (create app → copy public `client_id`; register each site's `callback.html` as a redirect URI); and the **static-hosting** story (no backend needed — PKCE, direct token fetch, static callback). Match the depth/style of the existing Subsonic/YouTube sections.

- [ ] **Step 2: Update `AGENTS.md`**

Under "Providers", add a `spotify` bullet: SDK (Premium, full tracks) + embed (free, 30s previews) tiers behind a `SpotifyEngine` seam; provider-owned PKCE popup login (fully static, no backend); resolves from `track.spotifyUrl`; real engines browser-only/manual like `YtIframeEngine`. If a "Providers" count or list appears elsewhere in the file, keep it consistent.

- [ ] **Step 3: Verify + commit**

```bash
npm run lint && npm test && npm run build
git add README.md AGENTS.md
git commit -m "docs(spotify): document the provider, tiers, and static-host setup" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

- [ ] `npm run lint && npm test && npm run build` — all green.
- [ ] `git log --oneline` shows the task commits.
- [ ] Open a PR: `gh pr create` targeting `main`, summarizing tiers, PKCE/static-host support, and the manual-testing caveats.

## Self-review notes (author)

- **Spec coverage:** PKCE/auth (T1–T2), resolution/plumbing/availability (T3), tiering + embed fallback + connect + registry (T4), real SDK engine (T5), real embed engine (T6), harness + static callback (T7), docs incl. static-host (T8). All spec sections mapped.
- **Type consistency:** `SpotifyEngine.load(uri)` used consistently; `NotPremiumError` thrown by `WebPlaybackEngine.ready()` and caught in `connectWithFallback()`; `engineFactory(kind, getToken)` signature matches provider + tests.
- **Known browser-only gap:** T5/T6 engines are not unit-tested by design (repo precedent). Their contract is exercised via fakes in T3/T4; correctness of the real SDK/iframe wiring is confirmed manually in T7.
