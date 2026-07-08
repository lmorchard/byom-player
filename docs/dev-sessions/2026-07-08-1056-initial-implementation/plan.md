# `<byom-player>` Implementation Plan

**Goal:** A Lit web component that loads a JSPF playlist and plays it via
swappable audio providers (Mock + Direct/Navidrome this session).

**Approach:** Generic JSPF loader → clean internal model; adapter-pattern
providers; test-first for all deterministic logic (loader, state machine, queue,
provider resolution); the visual UI is tuned in an interactive prototype, then
ported. Vite lib build → single ES module.

**Tech stack:** Lit, TypeScript, Vite (library mode), Vitest + happy-dom, ESLint
+ Prettier. Verification via npm scripts (no Makefile — JS project).

---

## Phase 1: Scaffold + types + JSPF manifest loader

Stand up the toolchain and the pure JSPF→model loader. Loader is TDD; scaffolding
is infra (TDD opt-out).

**Files:**
- Create: `package.json` (deps: `lit`; dev: `vite`, `typescript`, `vitest`,
  `happy-dom`, `eslint`, `prettier`, `@typescript-eslint/*`), scripts:
  `dev`/`build`/`test`/`lint`/`format`.
- Create: `tsconfig.json` (`experimentalDecorators:true`,
  `useDefineForClassFields:false`, `moduleResolution:"bundler"`, `strict:true`).
- Create: `vite.config.ts` (`build.lib` entry `src/index.ts`, `formats:['es']`),
  `vitest` config with `environment:'happy-dom'`.
- Create: `.eslintrc` / `.prettierrc`, `.gitignore` (`node_modules`, `dist`, `tmp`).
- Create: `src/types.ts` (internal model from spec).
- Create: `src/manifest.ts` — `loadManifest`.
- Test: `src/manifest.test.ts`.

**Key changes:**
```ts
// manifest.ts
export const BYOM_EXT_NS = 'https://github.com/lmorchard/byom-sync'; // JSPF extension key

interface JspfTrack { title?: string; creator?: string; album?: string;
  duration?: number; identifier?: string[]; location?: string[];
  extension?: Record<string, unknown[]>; }

export function loadManifest(json: unknown): Playlist {
  const pl = (json as any).playlist ?? json;          // tolerate unwrapped
  return {
    title: pl.title ?? '', creator: pl.creator, dateCreated: pl.date,
    tracks: (pl.track ?? []).map(mapTrack),
  };
}

function mapTrack(t: JspfTrack): Track {
  return {
    title: t.title ?? '', artist: t.creator ?? '', album: t.album,
    isrc: parseIsrc(t.identifier), durationMs: t.duration ? t.duration * 1000 : undefined,
    spotifyUrl: t.location?.[0],
    syncState: readSyncState(t.extension),
  };
}
// parseIsrc(ids?): first id matching /^urn:isrc:(.+)/i → capture group, else undefined
// readSyncState(ext?): ext?.[BYOM_EXT_NS]?.[0] → {spotifyPresent, dateOrphaned} | undefined
```

**Verification — automated:**
- [x] `npm run build` succeeds (emits a single ES module in `dist/`)
- [x] `npm test` passes: maps creator→artist, `urn:isrc:X`→isrc, duration→ms×1000,
      `location[0]`→spotifyUrl, unwraps `{playlist:{}}`, empty track list
- [x] `npm test` passes: reads `syncState` from `extension[BYOM_EXT_NS]`; absent → undefined
- [x] `npm run lint` passes

**Verification — manual:**
- [x] Feed a real byom-sync JSPF export (from `byom-sync export jspf`) through the
      loader — "Dark jams", 32 tracks, fields map correctly (durationMs rounds to
      JSPF's second granularity; syncState undefined until byom-sync emits the extension)

---

## Phase 2: Provider interface + MockProvider + playback controller

The headless playback engine: `AudioProvider` interface, a timer-driven
`MockProvider`, and the queue/state controller (advance on `ended`, skip on
`error`). Pure logic — TDD.

**Files:**
- Create: `src/providers/types.ts` — `AudioProvider`, `ProviderState`.
- Create: `src/providers/MockProvider.ts` — emits state transitions on timers.
- Create: `src/controller.ts` — `PlaybackController` (owns index, provider, queue).
- Test: `src/providers/MockProvider.test.ts`, `src/controller.test.ts`.

**Key changes:**
```ts
// MockProvider: initialize()→'ready'; load(t)→'ready'; play()→'playing' then,
// after a (configurable, default short) timer, →'ended'; pause()→'paused';
// seek() no-op. onStateChange registers a callback. Timer injectable for tests.

// controller.ts
export class PlaybackController {
  index = 0;
  constructor(private provider: AudioProvider, private tracks: Track[],
              private onChange: () => void) {}
  async start(i = 0) { this.index = i; await this.provider.load(this.tracks[i]); await this.provider.play(); }
  private onProviderState(s: ProviderState) {
    if (s === 'ended') this.next();
    if (s === 'error') this.skip();      // mark + advance
    this.onChange();
  }
  next() { if (this.index < this.tracks.length - 1) this.start(this.index + 1); }
  skip() { this.next(); }
  // play/pause/select(i) delegate to provider
}
```

**Verification — automated:**
- [x] `npm test`: MockProvider transitions ready→playing→ended (fake timers),
      pause→paused
- [x] `npm test`: controller advances index on `ended`; stops at last track (no overrun)
- [x] `npm test`: controller skips to next on `error`
- [x] `npm test`: `start(i)` loads+plays track i (also prev/pause/onChange)
- [x] `npm run lint` passes

**Verification — manual:**
- [x] None (headless logic; covered by tests)

---

## Phase 3: `<byom-player>` Lit component (functional, minimal UI)

Wire the component: properties, reactive state, manifest fetch on connect,
controls bound to the controller, and a **minimal functional** render (plain
markup — visual design comes in Phase 5). TDD via happy-dom.

**Files:**
- Create: `src/ByomPlayer.ts` — the `@customElement('byom-player')` class.
- Create: `src/index.ts` — re-export / register.
- Create: `src/providers/registry.ts` — `provider` string → provider instance.
- Test: `src/ByomPlayer.test.ts`.

**Key changes:**
```ts
@customElement('byom-player')
export class ByomPlayer extends LitElement {
  @property() src = '';
  @property() provider = 'mock';
  @property({ attribute: false }) providerConfig: Record<string, unknown> = {};
  @state() playlist: Playlist | null = null;
  @state() currentIndex = 0;
  @state() playbackState: ProviderState = 'uninitialized';
  @state() progress = 0;
  @state() private failed = new Set<number>();

  async connectedCallback() {
    super.connectedCallback();
    const res = await fetch(this.src);
    this.playlist = loadManifest(await res.json());
    this.prov = createProvider(this.provider, this.providerConfig);
    await this.prov.initialize();
    this.controller = new PlaybackController(this.prov, this.playlist.tracks, () => this.sync());
  }
  // selectTrack(i), togglePlay(), next(), prev() → controller/provider
  // render(): header (title/creator), now-playing, controls, <ol> tracklist;
  //   active track → class 'active'; syncState?.spotifyPresent===false → class 'orphan';
  //   failed index → class 'unavailable'
}
```

**Verification — automated:**
- [x] `npm test`: on connect with a stubbed `fetch`, renders playlist title and
      one `<li>` per track
- [x] `npm test`: clicking a track sets `currentIndex` and calls provider load/play
- [x] `npm test`: provider `ended` advances the active track; `.active` moves
- [x] `npm test`: provider `error` adds `.unavailable` and advances
- [x] `npm test`: track with `syncState.spotifyPresent===false` renders `.orphan`
- [x] `npm run build` succeeds; `npm run lint` passes

**Verification — manual:**
- [x] `npm run dev` + Playwright: real browser rendered the sample (6 tracks,
      orphan at index 1), click-to-play started playback, mock auto-advanced
      through to the last track and stopped without overrun (visuals plain, expected)

_Adaptation: added an optional `providerFactory` property (host-supplied provider
injection) — used as the test seam and a real extensibility hook. A dev
`index.html` + `public/sample.jspf.json` were added for the dev server._

---

## Phase 4: DirectProvider (Navidrome / Subsonic)

Real audio for the homelab: resolve a `Track` to a Navidrome stream and play it
via HTML5 `Audio`. Resolution/URL construction is TDD (mock fetch); live playback
is manual.

**Files:**
- Create: `src/providers/DirectProvider.ts`.
- Test: `src/providers/DirectProvider.test.ts`.
- Modify: `src/providers/registry.ts` — register `'direct'`.

**Key changes:**
```ts
// providerConfig: { baseUrl, username, token, salt } (Subsonic auth params)
// resolve(track): GET {baseUrl}/rest/search3.view?query="{artist} {title}"
//   &u&t&s&v=1.16.1&c=byom-player&f=json → pick searchResult3.song[0].id
// streamUrl(id): {baseUrl}/rest/stream.view?id={id}&{auth}&c=byom-player
// load(): resolve → set audio.src=streamUrl; play(): audio.play();
//   map audio events: playing→'playing', pause→'paused', ended→'ended',
//   error / empty search → 'error'. seek(ms): audio.currentTime = ms/1000.
export class DirectProvider implements AudioProvider {
  name = 'direct';
  private audio = new Audio();
  // ...
}
```

**Verification — automated:**
- [ ] `npm test`: `resolve` builds the correct `search3` URL from providerConfig +
      `"{artist} {title}"` query, and picks `song[0].id` (mock fetch)
- [ ] `npm test`: empty search result → emits `'error'`
- [ ] `npm test`: `streamUrl` includes id + auth + client params
- [ ] `npm test`: HTMLAudio event → ProviderState mapping (dispatch fake events)
- [ ] `npm run lint` passes

**Verification — manual (needs Les's Navidrome + CORS):**
- [ ] `providerConfig` pointed at real Navidrome resolves and streams a known track
- [ ] Auto-advance and click-to-play work with real audio
- [ ] A track absent from Navidrome flags `.unavailable` and skips

---

## Phase 5: UI prototype → port (feel-driven)

**Not autonomous.** Build a disposable harness, tune the look/feel with Les, then
port the locked result into the component. TDD opt-out (subjective visuals);
Phase 3's behavior tests must still pass after the port.

**Files:**
- Create (gitignored): `tmp/prototype.html` — a standalone page with the tracklist,
  controls, now-playing, progress, and toggles/sliders for spacing, accent, active
  and orphan treatments, driven by a static sample manifest + MockProvider.
- Modify: `src/ByomPlayer.ts` `static styles` and `render()` — port the locked
  visuals; wire `progress` (0–100) to a progress element.
- Create: `demo/index.html` — the shipped demo page (theming via CSS vars).
- Modify: `README.md` — usage, theming variables, providerConfig, CORS note.

**Process:**
1. Build the harness; iterate with Les (he drives the live controls; I adjust
   structure/CSS). Lock: control layout, active-track treatment, orphan indicator,
   progress display, density, default CSS-var palette.
2. Port final CSS/markup into the component. Delete `tmp/`.

**Verification — automated:**
- [ ] `npm test`: all Phase 3 behavior tests still pass after the port
- [ ] `npm run build` succeeds; `npm run lint` passes

**Verification — manual:**
- [ ] Les signs off on the look/feel in the harness
- [ ] Ported component matches the harness; CSS variables re-theme it as expected
- [ ] Orphaned tracks visually distinct but still clickable

---

## Cross-phase notes

- **One commit per phase**, message `Phase N: <name>`.
- **byom-sync dependency (out of scope here):** a small PR in the byom-sync repo
  to emit `sync_state` in the JSPF track `extension` under `BYOM_EXT_NS`. Until
  then, tests/mock manifests carry the extension so the read path is exercised.
- **No Makefile:** verification uses `npm run build|test|lint`. If we want the
  dev-session `make lint`/`make test` muscle memory, add thin Makefile wrappers.
- YouTube provider is a deliberate fast-follow (separate session).
