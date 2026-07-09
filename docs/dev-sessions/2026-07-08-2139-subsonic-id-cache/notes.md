# Notes: Subsonic resolved-ID cache

## Summary

Added a localStorage-backed cache of resolved Subsonic song IDs so repeat plays
skip `search3`, plus self-healing when a cached ID goes stale.

- New `src/providers/resolutionCache.ts`: `ResolutionCache` interface,
  `trackKey()`, and `LocalStorageResolutionCache` (versioned root key
  `byom-player:resolv:v1`, in-memory fallback, FIFO entry cap).
- `SubsonicProvider.resolve()` reads the per-server cache before `search3` and
  writes positive results back — warming from the prescan's `checkAvailability`
  too. New `cache` flag (default on) + `resolutionCache` seam + `clearCache()`.
- **Evict-on-error:** a cached ID that errors *before playback ever starts* is
  treated as stale — evicted and re-resolved live once, then playback resumes.
  A mid-stream error (after the `playing` event) is left alone (`hasPlayed`
  discriminates the two).
- Dev harness: "🗑️ Clear ID cache" button (Subsonic only).

## Status

- 96 tests (18 new: 9 cache-unit, 5 provider cache-wiring, 4 evict-on-error).
  Lint + build clean.
- Dev-harness clear button verified live via Playwright (seed cache → click →
  key removed + status shown).
- **Live Navidrome verification still pending** (needs Les's creds in-browser).

## Key decisions

- **localStorage, not IndexedDB.** ~100 bytes/entry; an 8000-track library is
  ~0.8 MB, far under the ~5 MB budget. Sync API = simpler. Behind an interface
  so IndexedDB is a drop-in later.
- Positive caching only (no negative/miss caching).
- Cache scoped `subsonic:<baseUrl>` — server-specific IDs never shared.

## Gotchas hit

- **happy-dom exposes `localStorage` only on `window`, not as a bare global.**
  So `typeof localStorage === 'undefined'` in tests → the provider's default
  cache runs in-memory (per-instance, naturally isolated). A first attempt to
  add `localStorage.clear()` in `afterEach` threw and failed all 29 tests;
  removed it. Real browsers have the bare global, so persistence works there.
- **Pre-existing `checkAvailability` mapping test** re-resolves one track across
  three server states — incompatible with caching. Scoped it to `cache: false`
  (it tests status mapping, not caching). Not a weakening — correct scoping.
- **Dual-stack port collision:** a leftover main-checkout Vite server held
  IPv4 `127.0.0.1:5173` while the worktree server took IPv6 `[::1]:5173` — Vite
  reported no conflict. `curl` and Playwright resolved `localhost` to different
  servers, so the browser saw the old HTML without the new button. Fixed by
  running the worktree server on a dedicated port (`--port 5185 --strictPort`).
  Left the other agent's stray server alone.

## Post-plan refinements (Les, mid-session)

- **Prescan throttle skip.** `sweepAvailability`'s inter-check delay exists to be
  gentle on the *source*; a cache hit never touches it, so the delay was pure
  waste. Added optional `AudioProvider.isResolutionCached?(track)`, consulted
  before each check — cache hits skip the cooldown, so a fully-cached playlist
  prescans near-instantly. Backward-compatible.
- **Playlists un-ignored.** `public/playlists/` is no longer gitignored — the four
  JSPF files are committed as test fixtures (the harness presets reference them
  by name; Les intends to publish them as public mixtapes). Updated `.gitignore`
  and AGENTS.md.
- **Rebased onto origin/main** (Spotify #7 + tracklist #9). `index.html`
  auto-merged (Spotify fieldset + clear-cache button). `vite.config.ts` now binds
  `127.0.0.1` (Spotify PKCE) — dev server runs there.

## Known limitation (verify live)

Re-resolve-and-resume runs in an async continuation of the media `error` event,
outside the original user gesture — browser autoplay policy *may* block the
resumed `play()`. If so it surfaces as `error` (retry already spent). Confirm
against live Navidrome.

## Environment

- Worktree: `.claude/worktrees/subsonic-id-cache`, branch
  `worktree-subsonic-id-cache` (fresh from `origin/main`, which has the merged
  scrobble work).
- Dev server: `localhost:5185`.

## Live verification checklist (pending)

- Play a track → `search3` then `stream` in the network tab.
- Replay it → **no** `search3` (cache hit), straight to `stream`.
- Reload page, replay → still no `search3` (localStorage persisted).
- Force staleness (Navidrome rescan, or edit a cached id in devtools) → stale
  `stream` errors, `search3` re-resolves, playback recovers (watch autoplay
  caveat).
- "Clear ID cache" button → next play re-searches.
