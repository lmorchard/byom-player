# Notes: byom-player consumes resolved.youtube (Part 2)

## Summary

byom-player now plays YouTube from a manifest-embedded video id — closing the
cross-repo loop with byom-sync's `resolve youtube`.

- **Read path:** `Track.resolvedIds?: { youtube?: string }`; `manifest.ts` reads
  `extension[BYOM_EXT_NS][0].resolved` (string-only, else ignored) alongside
  `sync_state`.
- **YouTubeProvider resolution chain** (reuses `ResolutionCache`, scope `youtube`):
  embedded id → cache (hit/known-miss) → live search (only if `searchEndpoint`/
  `apiKey` set; caches hits, negative-caches misses w/ TTL) → give up (null).
  No search config is no longer an error — enriched/cached tracks resolve.
- **`checkAvailability`:** embedded/cache → available; known-miss → unavailable;
  search-if-key → available/unavailable; else unknown. **`isResolutionCached`:**
  true for embedded/cached, so the prescan skips its throttle.

## Status

- 140 tests (new: manifest resolved.youtube; provider chain, checkAvailability,
  isResolutionCached, cache/negative-cache). Lint + build clean.
- **Verified live in-browser:** loaded the enriched `20150907` playlist with the
  youtube provider and NO key; playing "Ladytron - Playgirl" played the embedded
  id `qMH6wljk4Xw` (real YouTube playback) with **no Data API search request**.

## Decisions

- Cache scope `youtube` (video ids universal, not per-server).
- Graceful with no key: enriched playlists play key-free.
- checkAvailability searches when a key IS set (Les's call) — see quota note.

## Quota note (prescan)

With a key configured AND an unenriched playlist, the background sweep's
`checkAvailability` searches every track (up to ~100/day) on load. Caching bounds
it to one search per track; the common no-key path never searches. A knob to
disable prescan-search can come later if it bites.

## Test data / fixtures

- Exported the resolved hub playlists from byom-sync (built from origin/main in a
  throwaway worktree) via `export jspf`; brought `20150907` in as
  `public/playlists/20150907.jspf.json` (30/31 tracks enriched) + a harness preset
  ("YouTube-enriched"). The other resolved playlists (2014/2015-top-songs,
  20160803, 20160905, …) are available in the hub if we want more fixtures.

## Environment

- Worktree `.claude/worktrees/youtube-consume`, branch `worktree-youtube-consume`
  (off main). Dev server binds `127.0.0.1` (Spotify PKCE config from an earlier
  merge) — used it for the live check.

## Follow-ups

- Move the Spotify URL into `resolved` for symmetry (breaking; own migration).
- Optional knob to disable prescan-search when a key is set.
- Resolve more hub playlists (byom-sync trickle) and export as they fill in.
