# In-Component Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `<byom-player>` self-configuring via an in-component settings panel (provider selection, credentials, auth, refresh/debug), with component-owned persistence and attribute-first host config.

**Architecture:** Two config layers — host-supplied deployment defaults (attribute-first) and user settings (panel-edited, persisted to localStorage) — merged into the effective provider config. The panel presents as an inline view swap over the tracklist. Providers render their existing auth buttons into a panel-owned slot via a new optional `attachAuth`. The component's one-shot `loadAndInit` is split into a reusable `loadPlaylist` + `initProvider` so settings changes re-init the provider in place without remounting.

**Tech Stack:** Lit 3, TypeScript, Vitest + happy-dom.

## Global Constraints

- Framework: Lit 3 web component; styles in `static styles` (Shadow DOM). Copy exact values.
- Tests: Vitest (`npx vitest run <file>`), happy-dom environment; follow existing patterns in `src/ByomPlayer.test.ts` (access privates via `el['name']`, `await el.updateComplete`, settle with `setTimeout(r, 0)`).
- Lint/format gate: `npm run lint` (eslint + prettier --check) must pass; run `npm run format` before committing.
- Type gate: `npm run build` runs `tsc --noEmit` — no type errors allowed.
- All host-side config MUST be settable via HTML attributes (deployment target is a static site generator). Object/array properties are programmatic escape hatches only.
- Built-in provider names: `mock`, `subsonic`, `youtube`, `spotify`, `plex`, `jellyfin`.
- localStorage keys: settings `byom-player:settings:v1`; resolution cache `byom-player:resolv:v1` (existing, in `src/providers/resolutionCache.ts`).
- The visual/skins pass is OUT OF SCOPE (issue #1). Keep current styling; add only the minimal structural CSS the panel needs.
- Existing Phase-3 behavior tests in `src/ByomPlayer.test.ts` MUST keep passing.
- Commit after each task. Commit message prefix: `feat(settings):` (or `refactor(...)`/`docs(...)` where noted). End every commit message with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Settings persistence + merge module

**Files:**
- Create: `src/settings.ts`
- Test: `src/settings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SETTINGS_KEY = 'byom-player:settings:v1'`
  - `interface UserSettings { provider?: string; debug?: boolean; providers: Record<string, Record<string, string>> }`
  - `loadSettings(storage?: Storage): UserSettings`
  - `saveSettings(settings: UserSettings, storage?: Storage): void`
  - `effectiveProviderConfig(provider: string, deployment: Record<string, Record<string, unknown>>, user: UserSettings): Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

Create `src/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
  effectiveProviderConfig,
  type UserSettings,
} from './settings';

describe('settings', () => {
  beforeEach(() => localStorage.clear());

  it('loads a normalized empty shape when nothing is stored', () => {
    expect(loadSettings()).toEqual({ providers: {} });
  });

  it('round-trips saved settings', () => {
    const s: UserSettings = {
      provider: 'subsonic',
      debug: true,
      providers: { subsonic: { baseUrl: 'https://m.example.com', username: 'me' } },
    };
    saveSettings(s);
    expect(localStorage.getItem(SETTINGS_KEY)).toContain('subsonic');
    expect(loadSettings()).toEqual(s);
  });

  it('returns the empty shape on malformed JSON (never throws)', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings()).toEqual({ providers: {} });
  });

  it('merges deployment defaults with user creds (user wins)', () => {
    const deployment = { spotify: { clientId: 'abc', redirectUri: 'https://x/cb' } };
    const user: UserSettings = { providers: { spotify: { clientId: 'user-override' } } };
    expect(effectiveProviderConfig('spotify', deployment, user)).toEqual({
      clientId: 'user-override',
      redirectUri: 'https://x/cb',
    });
  });

  it('returns just deployment config when no user creds for that provider', () => {
    const deployment = { youtube: { apiKey: 'k' } };
    expect(effectiveProviderConfig('youtube', deployment, { providers: {} })).toEqual({ apiKey: 'k' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/settings.test.ts`
Expected: FAIL — cannot resolve `./settings`.

- [ ] **Step 3: Write minimal implementation**

Create `src/settings.ts`:

```ts
// User settings are the panel-edited, component-owned half of configuration:
// which provider is active, per-provider credentials, and the debug flag.
// Persisted to localStorage; degrades to an empty shape (never throws) when
// storage is unavailable or corrupt.

export const SETTINGS_KEY = 'byom-player:settings:v1';

export interface UserSettings {
  provider?: string;
  debug?: boolean;
  // Per-provider credentials/URLs the user typed in the panel, keyed by
  // provider name (e.g. { subsonic: { baseUrl, username, password } }).
  providers: Record<string, Record<string, string>>;
}

const EMPTY: UserSettings = { providers: {} };

function storageOrNull(explicit?: Storage): Storage | null {
  if (explicit) return explicit;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(storage?: Storage): UserSettings {
  const s = storageOrNull(storage);
  if (!s) return { providers: {} };
  try {
    const raw = s.getItem(SETTINGS_KEY);
    if (!raw) return { providers: {} };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...parsed, providers: parsed.providers ?? {} };
  } catch {
    return { providers: {} };
  }
}

export function saveSettings(settings: UserSettings, storage?: Storage): void {
  const s = storageOrNull(storage);
  if (!s) return;
  try {
    s.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage full / unavailable — settings are best-effort
  }
}

// Effective config for one provider = deployment defaults for that provider,
// with the user's typed credentials layered on top (user wins).
export function effectiveProviderConfig(
  provider: string,
  deployment: Record<string, Record<string, unknown>>,
  user: UserSettings,
): Record<string, unknown> {
  return { ...(deployment[provider] ?? {}), ...(user.providers[provider] ?? {}) };
}
```

Reference `EMPTY` is defined for clarity but the functions return fresh objects to avoid shared mutation; keep `EMPTY` only if you reference it, otherwise delete it to satisfy lint. (Delete it — the functions return literals.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/settings.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Lint + commit**

```bash
npm run format
git add src/settings.ts src/settings.test.ts
git commit -m "feat(settings): user settings persistence + effective-config merge

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Host config parsing module

**Files:**
- Create: `src/hostConfig.ts`
- Test: `src/hostConfig.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ALL_PROVIDERS: readonly string[]` = `['mock','subsonic','youtube','spotify','plex','jellyfin']`
  - `DEFAULT_SPOTIFY_CLIENT_ID = ''`
  - `parseProviderList(csv: string | null): string[]`
  - `interface PlaylistEntry { title: string; src: string }`
  - `parsePlaylistChildren(host: Element): PlaylistEntry[]`
  - `interface DeploymentAttrs { spotifyClientId?: string; spotifyRedirectUri?: string; youtubeApiKey?: string; youtubeSearchEndpoint?: string }`
  - `buildDeploymentConfig(attrs: DeploymentAttrs, providerConfig: Record<string, unknown>, initialProvider: string): Record<string, Record<string, unknown>>`

- [ ] **Step 1: Write the failing test**

Create `src/hostConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ALL_PROVIDERS,
  parseProviderList,
  parsePlaylistChildren,
  buildDeploymentConfig,
} from './hostConfig';

describe('parseProviderList', () => {
  it('defaults to all providers when null/empty', () => {
    expect(parseProviderList(null)).toEqual([...ALL_PROVIDERS]);
    expect(parseProviderList('')).toEqual([...ALL_PROVIDERS]);
  });

  it('parses a CSV allowlist, trimming and dropping unknowns', () => {
    expect(parseProviderList('youtube, subsonic , bogus')).toEqual(['youtube', 'subsonic']);
  });

  it('falls back to all when the CSV names no known providers', () => {
    expect(parseProviderList('bogus,nope')).toEqual([...ALL_PROVIDERS]);
  });
});

describe('parsePlaylistChildren', () => {
  it('reads title + src from <byom-playlist> children', () => {
    const host = document.createElement('div');
    host.innerHTML =
      '<byom-playlist title="Road Trip" src="/rt.json"></byom-playlist>' +
      '<byom-playlist title="Chill" src="/chill.json"></byom-playlist>';
    expect(parsePlaylistChildren(host)).toEqual([
      { title: 'Road Trip', src: '/rt.json' },
      { title: 'Chill', src: '/chill.json' },
    ]);
  });

  it('ignores children missing src', () => {
    const host = document.createElement('div');
    host.innerHTML = '<byom-playlist title="No src"></byom-playlist>';
    expect(parsePlaylistChildren(host)).toEqual([]);
  });

  it('returns [] when there are no playlist children', () => {
    expect(parsePlaylistChildren(document.createElement('div'))).toEqual([]);
  });
});

describe('buildDeploymentConfig', () => {
  it('maps spotify + youtube attributes into per-provider config', () => {
    const dep = buildDeploymentConfig(
      {
        spotifyClientId: 'cid',
        spotifyRedirectUri: 'https://x/cb',
        youtubeApiKey: 'yk',
        youtubeSearchEndpoint: 'https://x/yt',
      },
      {},
      'mock',
    );
    expect(dep.spotify).toEqual({ clientId: 'cid', redirectUri: 'https://x/cb' });
    expect(dep.youtube).toEqual({ apiKey: 'yk', searchEndpoint: 'https://x/yt' });
  });

  it('folds the flat providerConfig escape hatch into the initial provider', () => {
    const dep = buildDeploymentConfig({}, { baseUrl: 'https://nav' }, 'subsonic');
    expect(dep.subsonic).toEqual({ baseUrl: 'https://nav' });
  });

  it('lets spotify attributes override the folded providerConfig', () => {
    const dep = buildDeploymentConfig(
      { spotifyClientId: 'attr-cid' },
      { clientId: 'legacy' },
      'spotify',
    );
    expect(dep.spotify.clientId).toBe('attr-cid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hostConfig.test.ts`
Expected: FAIL — cannot resolve `./hostConfig`.

- [ ] **Step 3: Write minimal implementation**

Create `src/hostConfig.ts`:

```ts
// Host-side (deployment) configuration parsing. Attribute-first: the static-site
// deployment authors HTML, so every host value has a string-attribute form.
// The flat `providerConfig` object stays as a programmatic escape hatch.

export const ALL_PROVIDERS = [
  'mock',
  'subsonic',
  'youtube',
  'spotify',
  'plex',
  'jellyfin',
] as const;

// No built-in default client id ships today; deployments set the real value via
// the `spotify-client-id` attribute. Empty means "not configured".
export const DEFAULT_SPOTIFY_CLIENT_ID = '';

// parseProviderList turns the `providers` allowlist attribute into a filtered
// list of known providers, defaulting to all when unset or when it names none.
export function parseProviderList(csv: string | null): string[] {
  if (!csv) return [...ALL_PROVIDERS];
  const wanted = csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => (ALL_PROVIDERS as readonly string[]).includes(s));
  return wanted.length ? wanted : [...ALL_PROVIDERS];
}

export interface PlaylistEntry {
  title: string;
  src: string;
}

// parsePlaylistChildren reads <byom-playlist title src> light-DOM children.
// They need not be registered custom elements — we only read attributes.
export function parsePlaylistChildren(host: Element): PlaylistEntry[] {
  const out: PlaylistEntry[] = [];
  for (const el of Array.from(host.querySelectorAll('byom-playlist'))) {
    const src = el.getAttribute('src');
    if (!src) continue;
    out.push({ title: el.getAttribute('title') ?? src, src });
  }
  return out;
}

export interface DeploymentAttrs {
  spotifyClientId?: string;
  spotifyRedirectUri?: string;
  youtubeApiKey?: string;
  youtubeSearchEndpoint?: string;
}

// buildDeploymentConfig assembles per-provider deployment defaults from the
// host's attributes, then folds the flat providerConfig escape hatch into the
// initial provider (backward compat). Attributes win over the escape hatch.
export function buildDeploymentConfig(
  attrs: DeploymentAttrs,
  providerConfig: Record<string, unknown>,
  initialProvider: string,
): Record<string, Record<string, unknown>> {
  const dep: Record<string, Record<string, unknown>> = {};

  // Legacy escape hatch seeds the initial provider's defaults.
  if (providerConfig && Object.keys(providerConfig).length) {
    dep[initialProvider] = { ...providerConfig };
  }

  const spotify: Record<string, unknown> = { ...(dep.spotify ?? {}) };
  if (attrs.spotifyClientId) spotify.clientId = attrs.spotifyClientId;
  if (attrs.spotifyRedirectUri) spotify.redirectUri = attrs.spotifyRedirectUri;
  if (Object.keys(spotify).length) dep.spotify = spotify;

  const youtube: Record<string, unknown> = { ...(dep.youtube ?? {}) };
  if (attrs.youtubeApiKey) youtube.apiKey = attrs.youtubeApiKey;
  if (attrs.youtubeSearchEndpoint) youtube.searchEndpoint = attrs.youtubeSearchEndpoint;
  if (Object.keys(youtube).length) dep.youtube = youtube;

  return dep;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hostConfig.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Lint + commit**

```bash
npm run format
git add src/hostConfig.ts src/hostConfig.test.ts
git commit -m "feat(settings): host-side config parsing (providers, playlists, deployment)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `attachAuth` provider interface + Spotify/Plex relocation

**Files:**
- Modify: `src/providers/types.ts` (add `attachAuth?`)
- Modify: `src/providers/spotify/SpotifyProvider.ts:90-102` (`renderControl`)
- Modify: `src/providers/plex/PlexProvider.ts:89-92, 118-179` (`attach`, render methods)
- Test: `src/providers/spotify/SpotifyProvider.test.ts`, `src/providers/plex/PlexProvider.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: optional `attachAuth(element: HTMLElement): void` on `AudioProvider`. When set, auth-capable providers render Connect/Link/Disconnect into that element; otherwise they fall back to the `attach`/video target (existing behavior).

- [ ] **Step 1: Add the interface method (no behavior yet)**

In `src/providers/types.ts`, after the `attach?` doc/decl (around line 41), add:

```ts
  // Optional: render auth controls (Connect/Link/Disconnect) into a host-provided
  // element — the settings panel's auth slot. Providers without interactive auth
  // omit it. When not called, providers fall back to the attach()/video target.
  attachAuth?(element: HTMLElement): void;
```

- [ ] **Step 2: Write the failing Spotify test**

In `src/providers/spotify/SpotifyProvider.test.ts`, add a test that the Connect button renders into the auth slot when `attachAuth` is used. Match the file's existing construction pattern (a fake `AuthLike` with `getValidToken` returning null → disconnected → Connect button). Add:

```ts
it('renders the Connect button into the attachAuth slot when provided', async () => {
  const video = document.createElement('div');
  const authSlot = document.createElement('div');
  const auth = {
    hasToken: () => false,
    getValidToken: async () => null,
    login: async () => 'tok',
    logout: () => {},
  };
  const provider = new SpotifyProvider({
    clientId: 'c',
    redirectUri: 'r',
    auth,
    engineFactory: () => makeFakeEngine(), // reuse the file's existing fake engine helper
  });
  provider.attach(video);
  provider.attachAuth!(authSlot);
  await provider.initialize();
  expect(authSlot.querySelector('.byom-spotify-connect')).toBeTruthy();
  expect(video.querySelector('.byom-spotify-connect')).toBeNull();
});
```

Note: if the test file has no reusable `makeFakeEngine`, construct the same fake engine the other tests in that file use (copy their inline engine literal). Do not weaken existing tests.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/providers/spotify/SpotifyProvider.test.ts`
Expected: FAIL — `attachAuth` is undefined / button lands in `video`.

- [ ] **Step 4: Implement Spotify relocation**

In `src/providers/spotify/SpotifyProvider.ts`:

Add a field near `target` (line ~34):

```ts
  private authTarget: HTMLElement | null = null;
```

Add the method next to `attach` (line ~44):

```ts
  attachAuth(element: HTMLElement): void {
    this.authTarget = element;
  }
```

Replace `renderControl` (lines ~90-102) with:

```ts
  private renderControl(kind: 'connect' | 'disconnect'): void {
    // Prefer the panel's auth slot; fall back to the video target (button
    // prepended above the embed, cleared by useEngine) when no slot is given.
    const target = this.authTarget ?? this.target;
    if (!target) return;
    // Slot mode reuses a persistent element across connect/disconnect, so clear
    // any prior control button first. (Video-fallback mode is already cleared by
    // useEngine before this runs.)
    target.querySelector('.byom-spotify-connect, .byom-spotify-disconnect')?.remove();
    const btn = target.ownerDocument.createElement('button');
    btn.className = kind === 'connect' ? 'byom-spotify-connect' : 'byom-spotify-disconnect';
    btn.textContent = kind === 'connect' ? 'Connect Spotify' : 'Disconnect Spotify';
    btn.addEventListener('click', () => {
      if (kind === 'connect') void this.handleConnectClick(btn);
      else void this.handleDisconnect();
    });
    if (this.authTarget) target.appendChild(btn);
    else target.prepend(btn);
  }
```

- [ ] **Step 5: Run Spotify tests**

Run: `npx vitest run src/providers/spotify/SpotifyProvider.test.ts`
Expected: PASS (new test + all existing).

- [ ] **Step 6: Write the failing Plex test**

In `src/providers/plex/PlexProvider.test.ts`, add (match the file's existing no-session construction that renders the Link button):

```ts
it('renders the Link button into the attachAuth slot when provided', async () => {
  const video = document.createElement('div');
  const authSlot = document.createElement('div');
  // Construct with the file's existing "no token, fake auth with no session"
  // pattern so initialize() takes the renderLink() path.
  const provider = makeUnlinkedProvider(); // reuse/inline the file's helper
  provider.attach(video);
  provider.attachAuth!(authSlot);
  await provider.initialize();
  expect(authSlot.querySelector('.byom-plex-link')).toBeTruthy();
  expect(video.querySelector('.byom-plex-link')).toBeNull();
});
```

If there's no `makeUnlinkedProvider` helper, inline the construction the existing "renders Link" test uses.

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/providers/plex/PlexProvider.test.ts`
Expected: FAIL — Link button lands in `video`.

- [ ] **Step 8: Implement Plex relocation**

In `src/providers/plex/PlexProvider.ts`:

Add field near `target`:

```ts
  private authTarget: HTMLElement | null = null;
```

Add method next to `attach` (line ~89):

```ts
  attachAuth(element: HTMLElement): void {
    this.authTarget = element;
  }
```

Add a private getter and switch the three render methods (`renderLink`, `renderPicker`, `renderUnlink`) to use it instead of `this.target`:

```ts
  private get authHost(): HTMLElement | null {
    return this.authTarget ?? this.target;
  }
```

In `renderLink`, `renderPicker`, `renderUnlink`, replace every `this.target` reference with `this.authHost` (they already call `.replaceChildren()` / `.appendChild()` / `.ownerDocument`). Leave `attach` and any playback code untouched.

- [ ] **Step 9: Run Plex tests + full provider suite**

Run: `npx vitest run src/providers/`
Expected: PASS (new tests + all existing).

- [ ] **Step 10: Lint + commit**

```bash
npm run format
git add src/providers/types.ts src/providers/spotify/SpotifyProvider.ts src/providers/plex/PlexProvider.ts src/providers/spotify/SpotifyProvider.test.ts src/providers/plex/PlexProvider.test.ts
git commit -m "feat(settings): attachAuth slot for provider auth controls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Split `loadAndInit` into `loadPlaylist` + `initProvider`; add re-init path

**Files:**
- Modify: `src/ByomPlayer.ts:73-131` (`loadAndInit`, `startSweep`)
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Consumes: `effectiveProviderConfig` is NOT used yet (Task 6); this task is a behavior-preserving refactor plus an in-place re-init path.
- Produces (private methods on `ByomPlayer`):
  - `private async loadPlaylist(): Promise<boolean>` — fetch + parse `this.src`; sets `this.playlist`; returns false on error (sets `playbackState='error'`).
  - `private async initProvider(): Promise<void>` — build provider from `this.provider` + current effective config, attach/attachAuth, initialize, build controller, start sweep. Disposes any existing controller first.
  - `private buildEffectiveConfig(): Record<string, unknown>` — for now returns `this.debug ? { ...this.providerConfig, debug: true } : { ...this.providerConfig }` (Task 5/6 extend it). This preserves current behavior.

- [ ] **Step 1: Write the failing re-init test**

In `src/ByomPlayer.test.ts`, add a test that calling the (new) private `initProvider` again disposes the old provider and installs a new one. Use two controllable providers via a `providerFactory` that returns a fresh instance per call:

```ts
it('re-initializes the provider in place (dispose old, install new)', async () => {
  const providers: ControllableProvider[] = [];
  const el = document.createElement('byom-player') as ByomPlayer;
  el.src = '/playlist.jspf.json';
  el.providerFactory = () => {
    const p = new ControllableProvider();
    providers.push(p);
    return p;
  };
  el.skipDelayMs = 0;
  el.prescanDelayMs = 0;
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  expect(providers).toHaveLength(1);

  await el['initProvider']();
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  expect(providers).toHaveLength(2);
  expect(providers[0].disposed).toBe(true); // old provider torn down
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: FAIL — `el['initProvider'] is not a function`.

- [ ] **Step 3: Refactor `loadAndInit` into the two steps**

In `src/ByomPlayer.ts`, replace `loadAndInit` (lines ~73-109) with:

```ts
  private async loadAndInit(): Promise<void> {
    if (!this.src) return;
    if (!(await this.loadPlaylist())) return;
    await this.initProvider();
  }

  // Fetch + parse the manifest at this.src. Returns false (and flags error) on
  // failure. Split out so a playlist switch can reload without touching the
  // provider, and a provider switch can re-init without refetching.
  private async loadPlaylist(): Promise<boolean> {
    this.sweepAbort?.abort();
    this.availability = new Map();
    this.hasVideo = false;
    try {
      const res = await fetch(this.src);
      this.playlist = loadManifest(await res.json());
      return true;
    } catch {
      this.playbackState = 'error';
      return false;
    }
  }

  // Effective provider config. Extended in later tasks to merge deployment
  // defaults + user settings; for now preserves the pre-panel behavior.
  private buildEffectiveConfig(): Record<string, unknown> {
    const cfg = { ...this.providerConfig };
    return this.debug ? { ...cfg, debug: true } : cfg;
  }

  // Build + initialize the active provider, wire the controller, start the
  // sweep. Disposes any existing provider/controller first so this is safe to
  // call on a settings change (no element remount).
  private async initProvider(): Promise<void> {
    if (!this.playlist) return;
    this.sweepAbort?.abort();
    this.controller?.dispose();
    this.controller = null;
    this.availability = new Map();
    this.failed = new Set();
    this.hasVideo = false; // reset; re-set below only if the new provider attaches

    const factory = this.providerFactory ?? createProvider;
    const prov = factory(this.provider, this.buildEffectiveConfig());
    if (prov.attach) {
      await this.updateComplete;
      const host = this.renderRoot.querySelector('.video');
      if (host) {
        prov.attach(host as HTMLElement);
        this.hasVideo = true;
      }
    }
    await prov.initialize();
    this.activeProvider = prov;
    this.controller = new PlaybackController(
      prov,
      this.playlist.tracks,
      () => this.syncFromController(),
      { skipDelayMs: this.skipDelayMs, debug: this.debug },
    );
    prov.onReset?.(() => this.handleProviderReset());
    this.startSweep();
  }
```

Keep `startSweep`, `handleProviderReset`, `syncFromController` as they are.

- [ ] **Step 4: Run the full ByomPlayer suite**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: PASS (new test + all existing behavior tests).

- [ ] **Step 5: Type-check + lint + commit**

```bash
npm run build && npm run format
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "refactor(player): split loadAndInit into loadPlaylist + initProvider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Host attributes + top-level playlist picker

**Files:**
- Modify: `src/ByomPlayer.ts` (properties, `connectedCallback`, `buildEffectiveConfig`, `render`, `static styles`)
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Consumes: `parseProviderList`, `parsePlaylistChildren`, `buildDeploymentConfig`, `PlaylistEntry`, `DEFAULT_SPOTIFY_CLIENT_ID` (Task 2); `effectiveProviderConfig`, `loadSettings` (Task 1).
- Produces (public reactive properties + state on `ByomPlayer`):
  - attributes: `providers` (string), `no-settings` (boolean → property `noSettings`), `spotify-client-id` (→ `spotifyClientId`), `youtube-api-key` (→ `youtubeApiKey`), `youtube-search-endpoint` (→ `youtubeSearchEndpoint`), `spotify-redirect-uri` (→ `spotifyRedirectUri`).
  - `private playlists: PlaylistEntry[]` populated from children.
  - `private deployment: Record<string, Record<string, unknown>>`.
  - `private settings: UserSettings`.
  - playlist picker `<select class="playlist-picker">` rendered near the header when `playlists.length > 1`; switching reloads.

- [ ] **Step 1: Write the failing tests**

In `src/ByomPlayer.test.ts`, add:

```ts
it('renders a top-level playlist picker from <byom-playlist> children and switches on change', async () => {
  const el = document.createElement('byom-player') as ByomPlayer;
  el.innerHTML =
    '<byom-playlist title="One" src="/one.json"></byom-playlist>' +
    '<byom-playlist title="Two" src="/two.json"></byom-playlist>';
  el.providerFactory = () => new ControllableProvider();
  el.skipDelayMs = 0;
  el.prescanDelayMs = 0;
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('.playlist-picker') as HTMLSelectElement;
  expect(picker).toBeTruthy();
  expect([...picker.options].map((o) => o.textContent!.trim())).toEqual(['One', 'Two']);
  expect(el.src).toBe('/one.json'); // first entry is the initial src

  picker.value = '/two.json';
  picker.dispatchEvent(new Event('change'));
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  expect(el.src).toBe('/two.json');
});

it('does not render a playlist picker for a single playlist', async () => {
  const el = document.createElement('byom-player') as ByomPlayer;
  el.src = '/one.json';
  el.providerFactory = () => new ControllableProvider();
  el.skipDelayMs = 0;
  el.prescanDelayMs = 0;
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('.playlist-picker')).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: FAIL — no `.playlist-picker`.

- [ ] **Step 3: Add imports + properties**

In `src/ByomPlayer.ts` add imports at top:

```ts
import { loadSettings, effectiveProviderConfig, type UserSettings } from './settings';
import {
  parseProviderList,
  parsePlaylistChildren,
  buildDeploymentConfig,
  DEFAULT_SPOTIFY_CLIENT_ID,
  type PlaylistEntry,
} from './hostConfig';
```

Add reactive properties (after `prescanDelayMs`, ~line 29):

```ts
  /** Comma-separated allowlist of selectable providers (defaults to all). */
  @property() providers = '';
  /** Hide the in-component settings gear/panel. */
  @property({ type: Boolean, attribute: 'no-settings' }) noSettings = false;
  /** Deployment default: Spotify client id (host-set, not user-editable). */
  @property({ attribute: 'spotify-client-id' }) spotifyClientId = '';
  /** Deployment default: Spotify redirect URI. */
  @property({ attribute: 'spotify-redirect-uri' }) spotifyRedirectUri = '';
  /** Deployment default: YouTube Data API key. */
  @property({ attribute: 'youtube-api-key' }) youtubeApiKey = '';
  /** Deployment default: YouTube search-proxy endpoint. */
  @property({ attribute: 'youtube-search-endpoint' }) youtubeSearchEndpoint = '';
```

Add private state (after `hasVideo`, ~line 41):

```ts
  @state() private playlists: PlaylistEntry[] = [];
  private settings: UserSettings = { providers: {} };
  private deployment: Record<string, Record<string, unknown>> = {};
```

- [ ] **Step 4: Wire parsing into connectedCallback + effective config**

Replace `connectedCallback` (lines ~48-51) with:

```ts
  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.settings = loadSettings();
    this.playlists = parsePlaylistChildren(this);
    // Multiple playlists: the first is the initial src unless the host set one.
    if (this.playlists.length && !this.src) this.src = this.playlists[0].src;
    // Persisted user selection wins over the host's default `provider`.
    if (this.settings.provider) this.provider = this.settings.provider;
    this.deployment = buildDeploymentConfig(
      {
        spotifyClientId: this.spotifyClientId || DEFAULT_SPOTIFY_CLIENT_ID || undefined,
        spotifyRedirectUri: this.spotifyRedirectUri || undefined,
        youtubeApiKey: this.youtubeApiKey || undefined,
        youtubeSearchEndpoint: this.youtubeSearchEndpoint || undefined,
      },
      this.providerConfig,
      this.provider,
    );
    await this.loadAndInit();
  }

  // The set of providers the user may select in the panel.
  private get allowedProviders(): string[] {
    return parseProviderList(this.providers || null);
  }
```

Replace `buildEffectiveConfig` (from Task 4) with the merged version:

```ts
  private buildEffectiveConfig(): Record<string, unknown> {
    const cfg = effectiveProviderConfig(this.provider, this.deployment, this.settings);
    return this.debug ? { ...cfg, debug: true } : cfg;
  }
```

- [ ] **Step 5: Add the playlist-switch handler + picker markup**

Add a method (near `selectTrack`, ~line 165):

```ts
  private async onPlaylistChange(e: Event): Promise<void> {
    const src = (e.currentTarget as HTMLSelectElement).value;
    if (src === this.src) return;
    this.src = src;
    if (await this.loadPlaylist()) await this.initProvider();
  }
```

In `render()`, immediately after the `<header>` block (after line ~225), add the picker:

```ts
      ${
        this.playlists.length > 1
          ? html`<select
              class="playlist-picker"
              aria-label="Playlist"
              .value=${this.src}
              @change=${this.onPlaylistChange}
            >
              ${this.playlists.map(
                (p) => html`<option value=${p.src}>${p.title}</option>`,
              )}
            </select>`
          : nothing
      }
```

Add minimal CSS to `static styles` (before the closing backtick):

```ts
    .playlist-picker {
      margin: 0.25rem 0 0.5rem;
      background: var(--byom-bg);
      color: var(--byom-text);
      border: 1px solid var(--byom-accent);
      border-radius: calc(var(--byom-border-radius) / 2);
      padding: 0.25rem 0.4rem;
      font: inherit;
    }
```

- [ ] **Step 6: Run the full ByomPlayer suite**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: PASS (new picker tests + all existing).

- [ ] **Step 7: Type-check + lint + commit**

```bash
npm run build && npm run format
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(settings): host attributes + top-level playlist picker

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Settings panel shell (gear, inline view swap, provider select, config fields, apply)

**Files:**
- Modify: `src/ByomPlayer.ts` (state, render, methods, styles)
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Consumes: `saveSettings` (Task 1), `allowedProviders` (Task 5), `initProvider`/`buildEffectiveConfig` (Task 4/5).
- Produces:
  - `@state() private view: 'list' | 'settings' = 'list'`
  - `@state() private draft: UserSettings` (working copy while the panel is open)
  - gear button `.gear` in the control row (hidden when `noSettings`)
  - settings container `.settings` (always in the DOM; hidden when `view==='list'`) with a provider `<select class="provider-select">`, per-provider credential inputs `.provider-fields`, and an `.apply` button
  - `applySettings()` persists the draft, re-inits the provider, emits `settingschange`, returns to list view

Field schema per provider (used to render inputs and read them back):

```ts
const PROVIDER_FIELDS: Record<string, { key: string; label: string; type?: string }[]> = {
  subsonic: [
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'apiKey', label: 'API key' },
  ],
  plex: [{ key: 'baseUrl', label: 'Base URL' }, { key: 'token', label: 'X-Plex-Token' }],
  jellyfin: [
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'token', label: 'API token' },
    { key: 'userId', label: 'User ID' },
  ],
  youtube: [],
  spotify: [],
  mock: [],
};
```

- [ ] **Step 1: Write the failing tests**

In `src/ByomPlayer.test.ts`, add:

```ts
it('shows the settings gear by default and hides it with no-settings', async () => {
  const { el } = await mount();
  expect(el.shadowRoot!.querySelector('.gear')).toBeTruthy();

  const el2 = document.createElement('byom-player') as ByomPlayer;
  el2.src = '/playlist.jspf.json';
  el2.setAttribute('no-settings', '');
  el2.providerFactory = () => new ControllableProvider();
  el2.skipDelayMs = 0;
  el2.prescanDelayMs = 0;
  document.body.appendChild(el2);
  await new Promise((r) => setTimeout(r, 0));
  await el2.updateComplete;
  expect(el2.shadowRoot!.querySelector('.gear')).toBeNull();
});

it('opens the settings view (inline swap) and closes back to the list', async () => {
  const { el } = await mount();
  expect(el.shadowRoot!.querySelector('.settings.open')).toBeNull();
  (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('.settings.open')).toBeTruthy();
  (el.shadowRoot!.querySelector('.settings-back') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('.settings.open')).toBeNull();
});

it('applies settings: persists creds + provider and re-inits, emitting settingschange', async () => {
  const providers: ControllableProvider[] = [];
  const el = document.createElement('byom-player') as ByomPlayer;
  el.src = '/playlist.jspf.json';
  el.providerFactory = (name) => {
    const p = new ControllableProvider();
    p.name = name;
    providers.push(p);
    return p;
  };
  el.skipDelayMs = 0;
  el.prescanDelayMs = 0;
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;

  let fired = false;
  el.addEventListener('settingschange', () => (fired = true));

  (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
  await el.updateComplete;
  const sel = el.shadowRoot!.querySelector('.provider-select') as HTMLSelectElement;
  sel.value = 'subsonic';
  sel.dispatchEvent(new Event('change'));
  await el.updateComplete;
  const baseUrl = el.shadowRoot!.querySelector(
    '.provider-fields input[name="baseUrl"]',
  ) as HTMLInputElement;
  baseUrl.value = 'https://nav.example.com';
  baseUrl.dispatchEvent(new Event('input'));
  (el.shadowRoot!.querySelector('.apply') as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;

  expect(fired).toBe(true);
  expect(el.provider).toBe('subsonic');
  expect(providers.at(-1)!.name).toBe('subsonic'); // re-init with new provider
  const stored = JSON.parse(localStorage.getItem('byom-player:settings:v1')!);
  expect(stored.provider).toBe('subsonic');
  expect(stored.providers.subsonic.baseUrl).toBe('https://nav.example.com');
});
```

Add `localStorage.clear()` to the existing `afterEach` (or a `beforeEach`) in this describe block so settings don't leak between tests.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: FAIL — no `.gear` / `.settings` / `.provider-select`.

- [ ] **Step 3: Add state + field schema + import**

In `src/ByomPlayer.ts`, extend the settings import:

```ts
import { loadSettings, saveSettings, effectiveProviderConfig, type UserSettings } from './settings';
```

Add the `PROVIDER_FIELDS` constant above the `@customElement` decorator (module scope), exactly as in the Interfaces block above.

Add state (near `view`-adjacent state):

```ts
  @state() private view: 'list' | 'settings' = 'list';
  @state() private draft: UserSettings = { providers: {} };
```

- [ ] **Step 4: Add gear + view-swap + apply methods**

Add methods (near `togglePlay`, ~line 169):

```ts
  private openSettings(): void {
    // Deep-copy current settings into a draft the form mutates.
    this.draft = {
      provider: this.provider,
      debug: this.debug,
      providers: structuredClone(this.settings.providers),
    };
    this.view = 'settings';
  }

  private closeSettings(): void {
    this.view = 'list';
  }

  private onDraftProvider(e: Event): void {
    this.draft = { ...this.draft, provider: (e.currentTarget as HTMLSelectElement).value };
  }

  private onDraftField(provider: string, key: string, e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    const providers = { ...this.draft.providers, [provider]: { ...this.draft.providers[provider], [key]: value } };
    this.draft = { ...this.draft, providers };
  }

  private async applySettings(): Promise<void> {
    this.settings = {
      provider: this.draft.provider,
      debug: this.draft.debug,
      providers: this.draft.providers,
    };
    saveSettings(this.settings);
    if (this.draft.provider) this.provider = this.draft.provider;
    this.dispatchEvent(
      new CustomEvent('settingschange', { detail: this.settings, bubbles: true, composed: true }),
    );
    this.view = 'list';
    await this.initProvider();
  }
```

- [ ] **Step 5: Add gear to the controls row**

In `render()`, inside `.controls`, after the shuffle button (~line 263), add:

```ts
        ${
          this.noSettings
            ? nothing
            : html`<button class="gear" @click=${this.openSettings} aria-label="Settings" title="Settings">⚙</button>`
        }
```

- [ ] **Step 6: Render the settings container (always present, toggled)**

In `render()`, replace the `<ol class="tracklist ...">…</ol>` block so the tracklist and settings are siblings, one shown at a time. Put this where the tracklist currently is:

```ts
      <ol class="tracklist ${this.hasVideo ? 'with-video' : ''}" ?hidden=${this.view === 'settings'}>
        ${pl.tracks.map((t, i) => {
          const orphaned = t.syncState?.spotifyPresent === false;
          return html`
            <li class=${this.trackClasses(i, orphaned)} @click=${() => this.selectTrack(i)}>
              <span class="t-title">${t.title}</span>
              <span class="t-artist">${t.artist}</span>
            </li>
          `;
        })}
      </ol>
      <div class="settings ${this.view === 'settings' ? 'open' : ''}" ?hidden=${this.view === 'list'}>
        <div class="settings-head">
          <button class="settings-back" @click=${this.closeSettings} aria-label="Back">←</button>
          <span class="settings-title">Settings</span>
        </div>
        <label class="field">
          <span>Provider</span>
          <select class="provider-select" .value=${this.draft.provider ?? this.provider} @change=${this.onDraftProvider}>
            ${this.allowedProviders.map((p) => html`<option value=${p}>${p}</option>`)}
          </select>
        </label>
        <div class="provider-fields">
          ${(PROVIDER_FIELDS[this.draft.provider ?? this.provider] ?? []).map(
            (f) => html`<label class="field">
              <span>${f.label}</span>
              <input
                name=${f.key}
                type=${f.type ?? 'text'}
                autocomplete="off"
                .value=${this.draft.providers[this.draft.provider ?? this.provider]?.[f.key] ?? ''}
                @input=${(e: Event) => this.onDraftField(this.draft.provider ?? this.provider, f.key, e)}
              />
            </label>`,
          )}
          ${
            (PROVIDER_FIELDS[this.draft.provider ?? this.provider] ?? []).length === 0
              ? html`<p class="field-note">No configuration needed.</p>`
              : nothing
          }
        </div>
        <button class="apply" @click=${this.applySettings}>Apply</button>
      </div>
```

Note: the `.settings.open` class is what the "open" test asserts; `?hidden` handles visibility. Keep both.

- [ ] **Step 7: Add minimal panel CSS**

Add to `static styles`:

```ts
    .controls .gear {
      margin-left: auto;
      background: transparent;
      border: none;
      color: var(--byom-text);
      font-size: 1.2rem;
      opacity: 0.7;
    }
    .settings {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 60vh;
      overflow: auto;
    }
    .settings-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .settings-back {
      background: transparent;
      border: none;
      color: var(--byom-text);
      cursor: pointer;
      font-size: 1.1rem;
    }
    .settings .field {
      display: grid;
      gap: 0.15rem;
      font-size: 0.8rem;
      opacity: 0.9;
    }
    .settings .field input,
    .settings .field select {
      background: var(--byom-bg);
      color: var(--byom-text);
      border: 1px solid var(--byom-accent);
      border-radius: calc(var(--byom-border-radius) / 2);
      padding: 0.3rem;
      font: inherit;
    }
    .settings .apply {
      align-self: flex-start;
      background: var(--byom-accent);
      color: var(--byom-bg);
      border: none;
      border-radius: 999px;
      padding: 0.4rem 1rem;
      cursor: pointer;
      font-weight: bold;
    }
    .field-note {
      font-size: 0.8rem;
      opacity: 0.6;
    }
    [hidden] {
      display: none !important;
    }
```

- [ ] **Step 8: Run the full ByomPlayer suite**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: PASS (new panel tests + all existing).

- [ ] **Step 9: Type-check + lint + commit**

```bash
npm run build && npm run format
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(settings): inline settings panel (provider + credentials + apply)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Connection/auth slot + attachAuth wiring

**Files:**
- Modify: `src/ByomPlayer.ts` (`initProvider`, render the auth slot inside `.settings`)
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Consumes: provider `attachAuth?` (Task 3).
- Produces: a persistent `.auth-slot` element inside the settings container; `initProvider` calls `prov.attachAuth(slot)` when the method exists.

- [ ] **Step 1: Write the failing test**

```ts
it('passes the panel auth slot to a provider that supports attachAuth', async () => {
  let authEl: HTMLElement | null = null;
  const el = document.createElement('byom-player') as ByomPlayer;
  el.src = '/playlist.jspf.json';
  el.providerFactory = () => {
    const p = new ControllableProvider();
    (p as AudioProvider).attachAuth = (e: HTMLElement) => (authEl = e);
    return p;
  };
  el.skipDelayMs = 0;
  el.prescanDelayMs = 0;
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  expect(authEl).toBe(el.shadowRoot!.querySelector('.auth-slot'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: FAIL — `authEl` is null / no `.auth-slot`.

- [ ] **Step 3: Render the auth slot**

In `render()`, inside `.settings`, add a Connection section above the `.apply` button:

```ts
        <div class="settings-connection">
          <span class="settings-label">Connection</span>
          <div class="auth-slot" part="auth"></div>
        </div>
```

- [ ] **Step 4: Wire attachAuth in initProvider**

In `initProvider`, after the `prov.attach` block and before `await prov.initialize()`, add:

```ts
    if (prov.attachAuth) {
      await this.updateComplete;
      const authHost = this.renderRoot.querySelector('.auth-slot');
      if (authHost) prov.attachAuth(authHost as HTMLElement);
    }
```

(The `.settings` container is always rendered, just hidden, so `.auth-slot` exists even while the list view is showing.)

- [ ] **Step 5: Add minimal CSS**

```ts
    .settings-connection {
      display: grid;
      gap: 0.3rem;
    }
    .settings-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.6;
    }
    .auth-slot {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .auth-slot button {
      cursor: pointer;
      background: var(--byom-accent);
      color: var(--byom-bg);
      border: none;
      border-radius: 999px;
      padding: 0.35rem 0.9rem;
      font: inherit;
    }
```

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: PASS.

- [ ] **Step 7: Type-check + lint + commit**

```bash
npm run build && npm run format
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(settings): panel auth slot wired to provider attachAuth

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Refresh availability + debug toggle actions

**Files:**
- Modify: `src/ByomPlayer.ts` (Actions section in `.settings`, methods)
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Consumes: `initProvider` (Task 4), resolution cache key `byom-player:resolv:v1`.
- Produces:
  - `refreshAvailability()` — clears the resolution-cache localStorage key and re-inits the provider (fresh sweep).
  - `onDraftDebug(e)` — toggles `draft.debug`; applied on Apply (re-init picks up debug via `buildEffectiveConfig`).

- [ ] **Step 1: Write the failing tests**

```ts
it('refresh availability clears the resolution cache and re-inits', async () => {
  localStorage.setItem('byom-player:resolv:v1', '{"some":"cache"}');
  const providers: ControllableProvider[] = [];
  const el = document.createElement('byom-player') as ByomPlayer;
  el.src = '/playlist.jspf.json';
  el.providerFactory = () => {
    const p = new ControllableProvider();
    providers.push(p);
    return p;
  };
  el.skipDelayMs = 0;
  el.prescanDelayMs = 0;
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
  await el.updateComplete;
  (el.shadowRoot!.querySelector('.refresh') as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  expect(localStorage.getItem('byom-player:resolv:v1')).toBeNull();
  expect(providers.length).toBeGreaterThan(1);
});

it('debug toggle is persisted and flows into the effective config on apply', async () => {
  const configs: Record<string, unknown>[] = [];
  const el = document.createElement('byom-player') as ByomPlayer;
  el.src = '/playlist.jspf.json';
  el.providerFactory = (_name, config) => {
    configs.push(config);
    return new ControllableProvider();
  };
  el.skipDelayMs = 0;
  el.prescanDelayMs = 0;
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
  await el.updateComplete;
  const dbg = el.shadowRoot!.querySelector('.debug-toggle') as HTMLInputElement;
  dbg.checked = true;
  dbg.dispatchEvent(new Event('change'));
  (el.shadowRoot!.querySelector('.apply') as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  expect(configs.at(-1)!.debug).toBe(true);
  const stored = JSON.parse(localStorage.getItem('byom-player:settings:v1')!);
  expect(stored.debug).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: FAIL — no `.refresh` / `.debug-toggle`.

- [ ] **Step 3: Add the methods**

```ts
  private async refreshAvailability(): Promise<void> {
    try {
      localStorage.removeItem('byom-player:resolv:v1');
    } catch {
      // ignore storage errors
    }
    await this.initProvider();
  }

  private onDraftDebug(e: Event): void {
    this.draft = { ...this.draft, debug: (e.currentTarget as HTMLInputElement).checked };
  }
```

`applySettings` already sets `this.debug`? It does not — add one line in `applySettings` after computing `this.settings`:

```ts
    this.debug = this.settings.debug ?? false;
```

(Place it right after `saveSettings(this.settings);` so `buildEffectiveConfig` sees the new debug flag on the subsequent `initProvider`.)

- [ ] **Step 4: Add the Actions markup**

In `.settings`, before the `.apply` button, add:

```ts
        <div class="settings-actions">
          <button class="refresh" @click=${this.refreshAvailability}>Refresh availability</button>
          <label class="field debug-field">
            <input
              class="debug-toggle"
              type="checkbox"
              .checked=${this.draft.debug ?? false}
              @change=${this.onDraftDebug}
            />
            <span>Debug diagnostics</span>
          </label>
        </div>
```

Add CSS:

```ts
    .settings-actions {
      display: grid;
      gap: 0.5rem;
    }
    .debug-field {
      grid-auto-flow: column;
      justify-content: start;
      align-items: center;
      gap: 0.4rem;
    }
    .refresh {
      justify-self: start;
      background: transparent;
      color: var(--byom-text);
      border: 1px solid var(--byom-accent);
      border-radius: 999px;
      padding: 0.3rem 0.9rem;
      cursor: pointer;
      font: inherit;
    }
```

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check + lint + commit**

```bash
npm run build && npm run format
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(settings): refresh-availability + debug toggle panel actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Dev harness rework (`index.html`)

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: the component's new attributes + in-panel config.

This task has no unit tests (it's the dev page); verify manually via `npm run dev`.

- [ ] **Step 1: Remove per-provider credential fieldsets**

Delete the `<fieldset id="fs-subsonic">`, `fs-youtube`, `fs-spotify`, `fs-plex`, `fs-jellyfin` blocks (index.html lines ~128-188) and the `buildProviderConfig` function (lines ~239-277) plus the `syncProviderUI` fieldset toggles. Credentials are entered in the player panel now.

- [ ] **Step 2: Keep provider select + a deployment-config area**

Keep the Provider select. Add a small "Deployment (host attributes)" fieldset with inputs for `spotify-client-id`, `youtube-api-key`, `youtube-search-endpoint`, still persisted to the existing `localStorage` dev-config key. These map to the component's new attributes.

- [ ] **Step 3: Author playlists as child elements**

Change `mount(cfg)` so that instead of setting `el.src` from a preset dropdown value, it emits the preset list as `<byom-playlist>` children (title + src) to exercise the real top-level picker, and sets deployment values as attributes:

```js
function mount(cfg) {
  host.innerHTML = '';
  const el = document.createElement('byom-player');
  el.provider = cfg.provider || 'mock';
  if (cfg.spotifyClientId) el.setAttribute('spotify-client-id', cfg.spotifyClientId);
  if (cfg.ytApiKey) el.setAttribute('youtube-api-key', cfg.ytApiKey);
  if (cfg.searchEndpoint) el.setAttribute('youtube-search-endpoint', cfg.searchEndpoint);
  for (const p of PRESETS) {
    const pl = document.createElement('byom-playlist');
    pl.setAttribute('title', p.title);
    pl.setAttribute('src', p.src);
    el.appendChild(pl);
  }
  host.appendChild(el);
}
```

Define `PRESETS` from the existing preset `<option>` list (title + src pairs). Keep the "random from Navidrome" button (dev-only) — it still builds a synthetic JSPF blob and sets `el.src` (single-playlist path) via a fresh `mount` that skips the preset children.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open the harness. Confirm:
- The player shows a playlist picker (multiple presets) and a settings gear.
- Opening settings lets you pick a provider and enter credentials; Apply plays.
- Reloading the page preserves settings (localStorage).
- `random from Navidrome` still works.

- [ ] **Step 5: Lint + commit**

```bash
npm run format
git add index.html
git commit -m "chore(harness): move credential entry into the component panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: README documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Properties/attributes table**

Add rows for `providers`, `no-settings`, `spotify-client-id`, `spotify-redirect-uri`, `youtube-api-key`, `youtube-search-endpoint`, and note that user provider/credentials are now set in the in-component settings panel and persisted to `localStorage` (`byom-player:settings:v1`).

- [ ] **Step 2: Add a "Settings panel" section**

Document: the gear opens an inline panel; users pick a provider, enter credentials, connect/disconnect auth, refresh availability, toggle debug. Note the deployment-vs-user split (host sets secrets via attributes; users set their own credentials in the panel). Include the `<byom-playlist>` multi-playlist example:

```html
<byom-player provider="youtube" providers="youtube,subsonic" spotify-client-id="...">
  <byom-playlist title="Road Trip" src="/road-trip.jspf.json"></byom-playlist>
  <byom-playlist title="Chill Evening" src="/chill.jspf.json"></byom-playlist>
</byom-player>
```

- [ ] **Step 3: Add the security note**

State that user-entered credentials (including passwords) are stored in origin-scoped `localStorage` in plaintext, and that `no-settings` deployments avoid this.

- [ ] **Step 4: Lint + commit**

```bash
npm run format
git add README.md
git commit -m "docs: settings panel, host attributes, and credential storage note

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `npm test` — all tests pass (Phase-3 regression + new).
- [ ] `npm run build` — `tsc --noEmit` clean + Vite build succeeds.
- [ ] `npm run lint` — eslint + prettier clean.
- [ ] Manual (`npm run dev`): open panel, switch provider, enter creds, Apply → playback; reload → settings persist; `no-settings` hides gear; `<byom-playlist>` children produce a picker; Spotify Connect / Plex Link render in the panel and complete.

## Self-review notes (author check against spec)

- **Config model** → Tasks 1, 2, 5 (deployment/user split, effective merge, debug global).
- **Attribute-first host config** → Task 5 (all host values as attributes; `providerConfig` escape hatch in Task 2).
- **`<byom-playlist>` children + top-level picker** → Tasks 2, 5.
- **Panel gating (`no-settings`)** → Task 6.
- **Inline view swap** → Task 6.
- **Auth slot (`attachAuth`)** → Tasks 3, 7.
- **Runtime re-init (no remount)** → Task 4 (+ used by 6, 7, 8).
- **Refresh availability + debug** → Task 8.
- **Dev harness rework** → Task 9.
- **Testing (regression + new units)** → every task ends with the relevant vitest run; regression guarded by keeping `ByomPlayer.test.ts` green throughout.
- **Security posture** → Task 10 (documented).
- **Visual/skins deferred** → not in any task (correct; issue #1 follow-up).
