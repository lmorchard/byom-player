# AGENTS.md — byom-player

Context for coding agents working on this repo. Read this first.

## What this is

`<byom-player>` is a framework-agnostic Web Component (Lit + TypeScript) that
loads a JSPF playlist manifest and plays it through swappable audio-provider
adapters. It's the playback frontend for [`byom-sync`](https://github.com/lmorchard/byom-sync),
but it consumes standard JSPF, so it works with any JSPF source.

The component is a UI + queue state machine; audio is delegated to providers.

## Stack

Lit 3 · TypeScript · Vite (library mode → single ES module) · Vitest +
happy-dom · ESLint (flat config) + Prettier. Local dev on Node 26; CI uses
Node 22.

## Layout

- `src/types.ts` — internal model (`Track`, `Playlist`, `SyncState`).
- `src/manifest.ts` — `loadManifest` (JSPF → model; reads `sync_state` from a
  JSPF track `extension` under `BYOM_EXT_NS`).
- `src/controller.ts` — `PlaybackController`: play order (identity or shuffled),
  advance/skip, circuit breaker, `positionMs`/`durationMs`, `seek`.
- `src/availability.ts` — `sweepAvailability` (gentle background prescan).
- `src/md5.ts` — vendored MD5 (RFC-verified) for Subsonic token auth.
- `src/ByomPlayer.ts` — the `@customElement('byom-player')`; syncs state from the
  controller, renders controls/progress/tracklist/video.
- `src/providers/` — `types.ts` (`AudioProvider`, `ProviderState`,
  `AvailabilityStatus`), `registry.ts` (`createProvider`), `MockProvider`,
  `SubsonicProvider`, `YouTubeProvider`.
- `index.html` — dev harness (not shipped). `public/` — `sample.jspf.json` and
  `public/playlists/` (committed JSPF test fixtures the harness presets load).

## Commands

`npm run dev` (Vite + harness) · `npm test` (Vitest) · `npm run lint` (ESLint +
Prettier check) · `npm run build` (`tsc --noEmit` + Vite lib build) ·
`npm run format`.

## Architecture / key concepts

- **`AudioProvider` interface** is the seam. Required: `initialize`, `load`,
  `play`, `pause`, `seek(ms)`, `onStateChange`, `dispose`. Optional: `onProgress`
  (position/duration ms), `checkAvailability`, `attach(element)` (mount a visible
  surface, e.g. YouTube video). Add a feature once here and every provider gets
  it.
- **`ProviderState`** distinguishes `unavailable` (source answered, no match →
  skip freely) from `error` (transient → circuit breaker). The controller trips
  the breaker after N consecutive errors so a flaky server isn't hammered;
  `unavailable`/misses don't count.
- **Controller** plays through an `order[]` (shuffle preserves the current
  track), keeps an `unavailable` skip-set fed by the prescan, and resets the
  breaker on user actions.
- **Component** mirrors controller state into `@state` and renders. Track classes:
  `active` / `orphan` (Spotify-removed, from manifest) / `unavailable` (not in
  collection) / `pending` (prescan hasn't reached it yet).
- **`providerFactory`** property is a test/extensibility seam — inject a custom
  or fake provider. YouTube uses a `YouTubeEngine` seam so its lifecycle is
  unit-tested with a fake (the real iframe engine is browser-only, manual).

## Providers

- **mock** — timer-driven, no infra; for dev/tests.
- **subsonic** (alias `direct`) — any Subsonic/OpenSubsonic server. Auth:
  username+password → **client-side salted MD5 token** (plaintext never sent);
  or `apiKey` (OpenSubsonic); or precomputed `token`+`salt`. Resolves via
  `search3`, streams via `stream`.
- **youtube** — IFrame API. Resolves `"{artist} {title} audio"` → videoId via a
  `searchEndpoint` (server-side key) or `apiKey` (YouTube Data API, dev-only,
  ~100 units/search quota). Uses `loadVideoById` (autoplay). No
  `checkAvailability` on purpose (prescan would burn quota). `attach` renders a
  visible video below the tracklist.
- **spotify** (`src/providers/spotify/`) — two tiers behind a `SpotifyEngine`
  seam (mirrors `YouTubeEngine`): `WebPlaybackEngine` (SDK, **Premium**, full
  tracks, headless) and `EmbedEngine` (iframe, 30s previews in practice — even
  for signed-in Premium; full tracks come from the SDK tier; visible chrome).
  Resolution is free — parses `track.spotifyUrl` (no search), so
  `checkAvailability` IS implemented (network-less). Provider-owned **PKCE**
  popup login (`pkce.ts`/`auth.ts`, fully static, no backend; token cached in
  `localStorage`). `initialize` picks the tier: `forceEmbed` → embed; token →
  SDK, falling back to embed on `NotPremiumError`; no token → mounts the embed
  (plays for a viewer already signed into Spotify) **and** shows a "Connect
  Spotify" button to upgrade to the SDK. Engine teardown + surface reset live in
  `useEngine()` so embed↔sdk swaps on connect/disconnect are clean. A Disconnect
  button clears the token + tears down the device. Real SDK/embed engines are
  browser-only/manual like `YtIframeEngine`; unit tests drive a fake engine +
  fake auth. Needs a registered Spotify app + `public/callback.html` as a
  redirect URI.
- **plex** (`src/providers/plex/`) — HTML5 `<audio>` like Subsonic (no engine
  seam). Resolves via `/library/search` → the first track's direct-play `Part`
  key (`firstTrackPartKey` tolerates both `SearchResult[].Metadata` and
  `Metadata[]` shapes); streams `{base}{part.key}?X-Plex-Token=…`. Reuses
  `resolutionCache` + the stale-part-key recovery pattern. Auth is **token-in**
  (`baseUrl` + `token`) **or** a poll-based **PIN device-link** (`plex.tv/api/v2`
  in `plex/auth.ts`): create pin → `app.plex.tv/auth` popup → poll → discover
  servers (`/resources`) → auto-select single/`serverName` or a picker →
  `pickConnection` probes `/identity` (prefers local, then `plex.direct`). No
  `callback.html` (poll-based, unlike Spotify); session cached in `localStorage`.
  `initialize`: token-in → ready; cached session → apply; else "Link Plex"
  button. Direct-play only (transcode is a follow-up). Live server + plex.tv CORS
  are verified manually.

## Gotchas

- **happy-dom + Lit:** a bare `${cond ? html`…` : nothing}` child expression
  placed directly before a mapped `<ol>` broke tracklist rendering. Wrap
  conditionals in a stable element (see the `.status`/`.video` wrappers).
- Tests use fake providers/engines + `happy-dom`; async provider chains need a
  macrotask flush (`await new Promise(r => setTimeout(r,0))`) before
  `updateComplete`. Seek uses a drag guard so incoming progress doesn't fight the
  thumb.
- `tsconfig` has no Node types — don't `import 'node:*'` in `src` (build's `tsc`
  will fail).

## Distribution

Rolling release (on push to `main`) builds the module and force-pushes it to a
`dist` branch, served by **jsDelivr** with correct MIME + CORS:
`https://cdn.jsdelivr.net/gh/lmorchard/byom-player@dist/byom-player.js`. The
GitHub **release asset is download-only** (octet-stream — can't be a live
`<script>`). npm publishing is deferred (issue #4).

## Workflow

- **Use PRs**, not direct pushes to `main`. Branch → PR → CI green → merge.
- Verify before claiming done: `npm run lint && npm test && npm run build`, and
  drive real behavior when relevant (the dev server + Playwright is how live
  playback got checked). Live Subsonic needs a server; live YouTube needs a
  search endpoint or API key (manual).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Dev-session artifacts in `docs/dev-sessions/`.

## Open issues

- **#1** — Phase 5 visual design pass. **Feel-driven and interactive** — do NOT
  build it autonomously; prototype the look with the human, then port. UI today
  is functional-but-plain by design.
- **#4** — publish to npm (then version-pinnable via jsDelivr/unpkg).
