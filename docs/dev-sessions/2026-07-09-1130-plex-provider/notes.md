# Notes: Plex provider

## Outcome

Implemented the `plex` provider end-to-end across 6 TDD tasks. All
`npm run lint && npm test && npm run build` green (155 tests). Dev-harness
wiring browser-verified: selecting Plex shows the fieldset, mounts the provider,
and (blank fields → PIN path) renders the "Link Plex" button with zero console
errors.

## What shipped

- `src/providers/plex/` — `types.ts`, `PlexProvider.ts` (resolve → direct-play
  via HTML5 `<audio>`, mirrors Subsonic; no engine seam), `auth.ts` (PIN
  device-link + server/connection discovery), plus `*.test.ts`.
- `registry.ts` — `case 'plex'` (+ registry test).
- `index.html` — Plex option (`baseUrl`/`token` fields + Link Plex path).
- `README.md` / `AGENTS.md` — provider docs.

## Design recap (as approved)

- HTML5 `<audio>` playback like Subsonic; reuses `resolutionCache` + stale-part
  recovery. Resolution: `/library/search?searchTypes=music` → first track's
  `Media[0].Part[0].key` → `{base}{part.key}?X-Plex-Token=…`.
- Auth (both): **token-in** (`baseUrl`+`token`) OR poll-based **PIN "Link
  Plex"** (`plex.tv/api/v2` pins → `app.plex.tv` popup → poll → `/resources`
  discovery → auto-select single/`serverName` or picker → `pickConnection`
  probes `/identity`). No `callback.html` (poll-based). Session cached in
  `localStorage`.
- Direct-play only (transcode deferred).

## Small deviations from the plan

- `firstTrackPartKey` tolerates both `MediaContainer.SearchResult[].Metadata`
  and `MediaContainer.Metadata[]` because the exact `/library/search` shape
  varies by Plex version and is confirmed live.
- The state-mapping unit test uses `cache: false` so the no-match miss isn't
  remembered between its two `load()` calls (caught in TDD — the cached miss
  otherwise shadowed the transient-error path).
- `link()` returns a `LinkResult` union (`PlexSession | { servers }`) defined up
  front in `types.ts`, so no mid-execution type change was needed.

## Manual testing still required (needs Les's real Plex server)

Not automatable here — flagged for a follow-up manual pass:

1. **Token-in:** harness → Plex → enter `baseUrl` (`https://<id>.plex.direct:32400`
   or `http://<lan-ip>:32400`) + an `X-Plex-Token`; load a byom-sync playlist;
   confirm resolve + playback + seek + auto-advance.
2. **PIN flow:** leave fields blank → "Link Plex" → authorize at app.plex.tv →
   confirm server auto-select (and the picker when the account has >1 server) →
   playback.
3. **CORS:** confirm the server and `plex.tv` allow the page origin (the one
   thing I couldn't verify without a live server). A local `http://` server from
   an `https://` page will hit mixed-content; `plex.direct` HTTPS avoids it.

## Follow-ups / ideas (not done)

- **Transcode fallback** for codecs the browser can't direct-play (Plex
  `/music/:/transcode/universal` endpoint).
- **Unlink** control in the linked state (parity with Spotify's disconnect);
  `auth.logout()` exists, just not surfaced in the UI yet.
- Plex "timeline" progress reporting (scrobble-equivalent), if wanted.
