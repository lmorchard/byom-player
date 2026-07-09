# Spec: byom-player consumes resolved.youtube (Part 2)

## Goal

Let byom-player play YouTube tracks without an on-demand search when the manifest
already carries a resolved video id (from byom-sync's `resolve youtube`), falling
back to cache then live search. Closes the cross-repo YouTube loop: enriched
playlists play instantly with no key/quota; unenriched ones degrade gracefully.

## Contract (from byom-sync, Part 1)

```json
"extension": { "https://github.com/lmorchard/byom-sync": [
  { "resolved": { "youtube": "<videoId>" } }
]}
```

## Components

### Read path (`src/types.ts`, `src/manifest.ts`)

- `Track.resolvedIds?: { youtube?: string }`.
- `manifest.ts` reads `extension[BYOM_EXT_NS][0].resolved` into `resolvedIds`
  (alongside the existing `sync_state` read). Only a string `resolved.youtube`
  is accepted; anything else → `resolvedIds` undefined.

### `YouTubeProvider` resolution chain

Reuses the existing `ResolutionCache` (`get`/`set`/`setMiss`, `trackKey`). Scope
is the constant `youtube` (video ids are universal — not per-server).

- Config: `YouTubeConfig` gains `cache?: boolean` (default on) and
  `resolutionCache?: ResolutionCache` (test/extensibility seam). `cache: false`
  disables the cache (`null`).
- `searchConfigured()` = `apiKey || searchEndpoint`.
- `cachedId(track)`: returns the embedded id (`track.resolvedIds.youtube`) if
  present, else `cache.get(youtube, trackKey)` → `string` (hit) | `null` (known
  miss) | `undefined` (unknown). Embedded wins over cache.
- `liveSearch(track)`: the existing `apiKey` / `searchEndpoint` fetch (query
  `"{artist} {title} audio"`), returning `videoId | null`; throws on transient
  HTTP failure. Assumes search is configured.

**`resolve(track): Promise<string | null>`** (playback):
1. `cachedId` → non-empty → return it (embedded or cache hit; no network).
2. `cachedId === null` → return `null` (known miss).
3. not configured → return `null` (can't resolve; do **not** cache — nothing was
   searched).
4. `liveSearch` → on id: `cache.set` + return; on null: `cache.setMiss` + return
   null. (Transient error propagates → controller circuit breaker.)

**`checkAvailability(track): Promise<AvailabilityStatus>`**:
1. `cachedId` non-empty → `available`.
2. `cachedId === null` → `unavailable`.
3. not configured → `unknown` (we can't tell without searching).
4. `liveSearch` (try/catch): id → `set` + `available`; null → `setMiss` +
   `unavailable`; throw → `unknown` (transient — don't penalize).

**`isResolutionCached(track): boolean`**: `cachedId(track) !== undefined` — true
for an embedded id or any cache entry (hit or known miss), so `sweepAvailability`
skips its throttle for those.

### Behavior change: graceful with no search config

Today `resolve` **throws** when neither `searchEndpoint` nor `apiKey` is set.
That becomes: an enriched (or cached) track resolves; an unenriched one returns
`null` (→ `unavailable`), not an error. So an enriched playlist plays with no
YouTube key at all.

## Quota note (prescan)

`sweepAvailability` sweeps the whole playlist. With a key configured and an
**un**enriched playlist, `checkAvailability` will search every track — up to the
~100/day quota — on load. Caching bounds it to one search per track (prescan
warms the cache; play reuses it), and the common no-key path never searches.
Flagged; a knob to disable prescan-search can come later if needed.

## Test data

Export the 5 resolved hub playlists from byom-sync (`export jspf`, which now
writes `resolved.youtube`) into `public/playlists/` as real fixtures for the dev
harness. Unit tests use inline hand-crafted JSPF/fixtures and don't depend on the
export.

## Testing

- `manifest.test.ts`: a JSPF track with `resolved.youtube` → `resolvedIds.youtube`;
  a track without → undefined; malformed `resolved` → undefined; `sync_state`
  still read.
- `YouTubeProvider.test.ts`:
  - embedded id → `resolve` returns it with **no** fetch; `checkAvailability` →
    `available`; `isResolutionCached` → true.
  - cache hit → returns it, no fetch. Live search → caches the id (second resolve
    no fetch). Search miss → `setMiss`; next resolve returns null with no fetch
    (known miss).
  - no config + no embedded/cache → `resolve` returns null (no throw);
    `checkAvailability` → `unknown`.
  - existing search-endpoint / apiKey / miss / transient-error tests still pass
    (embedded/cache empty → falls through to search).
  - `cache: false` → no cache reads/writes.

## Out of scope

- Moving the Spotify URL into `resolved` (separate migration).
- A config knob to disable prescan-search.
- Player-side changes beyond the provider + manifest (the component already
  passes `Track` to the provider).
