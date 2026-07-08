# `<byom-player>` Spec

**Goal:** A framework-agnostic Lit web component that loads a JSPF playlist
manifest and plays it through swappable audio-provider adapters, so byom-sync's
exported playlists become playable on any static site.

**Source:** `docs/player-spec.md` sketch + brainstorm 2026-07-08.

## Current state

Greenfield repo `byom-player` (git init, `main`, no code). Consumes output from
the sibling `byom-sync` CLI. Key facts (see `research.md`):

- byom-sync's **JSPF** spoke emits standard JSPF: `{playlist:{title, creator,
  date, track:[{title, creator, album, duration(sec), identifier:["urn:isrc:X"],
  location:["spotify_url"]}]}}`. It currently drops `sync_state`.
- JSPF supports an `extension` field: an object keyed by namespace URI whose
  values are arrays of arbitrary JSON — the standard-compatible place to carry
  `sync_state`.
- Both real audio providers need a resolution layer (YouTube: search→videoId;
  Direct/Navidrome: metadata→stream URL). A `location` (spotify_url) is not a
  playable audio stream.

## Desired end state

An ES-module web component usable as:
```html
<byom-player src="/playlists/road-trip.jspf.json" provider="direct"></byom-player>
```
- Fetches the JSPF manifest, normalizes it into a clean internal `Track` model,
  renders header / now-playing / controls / tracklist, and plays through the
  selected provider with automatic queue advance and error-skip.
- **Providers this session:** `MockProvider` (timer-driven, no infra — powers UI
  dev and tests) and `DirectProvider` (Navidrome/Subsonic resolution + HTML5
  `Audio`). YouTube provider is a fast-follow (not built here).
- Built with Vite in library mode → a single bundled ES module.
- Themable via CSS variables (`--byom-bg`, `--byom-text`, `--byom-accent`, …).

**Internal model (`types.ts`)** — the clean shape the UI uses; the loader adapts
JSPF into it:
```ts
interface Track { title: string; artist: string; album?: string; isrc?: string;
  durationMs?: number; spotifyUrl?: string;
  syncState?: { spotifyPresent: boolean; dateOrphaned?: string }; }
interface Playlist { title: string; creator?: string; dateCreated?: string; tracks: Track[]; }
type ProviderState = 'uninitialized'|'ready'|'playing'|'paused'|'ended'|'error';
interface AudioProvider { name: string; initialize(): Promise<void>;
  load(t: Track): Promise<void>; play(): Promise<void>; pause(): void;
  seek(ms: number): void; onStateChange(cb: (s: ProviderState)=>void): void; }
```

## Design decisions

- **Decision:** Manifest is **standard JSPF**; the player is a generic JSPF
  consumer. A `loadManifest()` maps JSPF → internal `Track` (creator→artist,
  parse `urn:isrc:`, duration×1000, `location[0]`→spotifyUrl, unwrap `playlist`).
  - **Why:** loose coupling — works with any JSPF source, not just byom-sync
    (matches the "framework-agnostic, droppable" goal). The only feature JSPF
    loses vs a hub dump is `sync_state`, and that's recoverable (below).
  - **Rejected:** hub-shaped JSON (binds the player to byom-sync for one field);
    tolerant multi-format loader (over-scoped for v1).

- **Decision:** `sync_state` rides in a JSPF track **`extension`** under a
  byom-sync namespace URI; the loader reads it if present and degrades gracefully
  when absent.
  - **Why:** keeps the orphan-indicator feature without breaking JSPF
    genericity. Requires a small byom-sync PR to emit it (tracked as a dependency;
    mock manifests carry it for dev meanwhile).
  - **Rejected:** dropping orphan info entirely.

- **Decision:** Adapter pattern — `AudioProvider` owns both resolution and
  playback in its `load()`. Ship `MockProvider` + `DirectProvider` this session.
  - **Why:** MockProvider (advances state on a timer, no network) lets the state
    machine, queue, and UI be built and unit-tested with zero audio infra;
    DirectProvider serves Les's real Navidrome homelab. YouTube deferred — its
    resolver needs an API key that can't ship in a public bundle.
  - **DirectProvider resolution:** Subsonic `search3` (query `"{artist} {title}"`,
    take top song) → `stream?id=`; config (base URL + credentials) via a
    `providerConfig` property. CORS must allow the host origin (documented).

- **Decision:** Build the **architecture test-first**, but treat the visual UI as
  an **interactive prototype** (disposable harness in gitignored `tmp/`), tuned
  by eye, then port the locked result into the component.
  - **Why:** provider/state-machine/queue/loader logic is deterministic and
    testable; the look and interaction feel (control layout, active/orphan
    styling, progress) is subjective and converges faster by seeing than
    speccing. Avoids autonomously locking in a UI nobody chose.

- **Decision:** Vite library mode (single ES module) + Lit + TS; tests via
  **Vitest + happy-dom**.
  - **Why:** one Vite toolchain for build/dev/test; happy-dom is fast for the
    logic and shadow-DOM assertions we need. (Web Test Runner is the alternative;
    Vitest keeps tooling unified.)

## Patterns to follow

- Lit idioms (`research.md` §3): `@customElement`, `@property()` for `src`/
  `provider`/`providerConfig`, `@state()` for `manifest`/`currentTrackIndex`/
  `playbackState`/`progress`, `static styles = css\`…\``, `render()`.
- Vite lib config, `experimentalDecorators` + `useDefineForClassFields:false`
  tsconfig (`research.md` §3).
- Manifest field-mapping table (`research.md` §1) is the loader's spec.

## What we're NOT doing

- **NOT** building the YouTube provider or any search→videoId backend (fast-follow).
- **NOT** a tolerant multi-format (JSPF + hub-JSON) loader — JSPF only.
- **NOT** autonomously building the visual UI — it goes through the prototype phase.
- **NOT** publishing to npm / setting up a CDN release in v1 (produce the build artifact).
- **NOT** playlist editing or any write-back — read-only player.
- **NOT** managing Navidrome secrets in-component beyond accepting `providerConfig`;
  CORS/credentials are the deployer's responsibility (documented).
- **NOT** the byom-sync JSPF `extension` emission itself (separate small PR in
  that repo); the player only needs to *read* it.

## Open questions

- **byom-sync extension namespace URI** — *Default:* `https://github.com/
  lmorchard/byom-sync` (or a `urn:byom-sync:*`); finalize when the byom-sync PR
  lands. Player reads whatever key we settle on. Proceed.
- **Navidrome match strategy** — *Default:* `search3` on `"{artist} {title}"`,
  take the top song; ISRC isn't reliably indexed. Flag unresolved tracks as
  errors (skip). Proceed.
- **providerConfig delivery** — *Default:* a JS `providerConfig` property (object)
  set by the host, plus optional JSON attribute for static markup. Proceed.
