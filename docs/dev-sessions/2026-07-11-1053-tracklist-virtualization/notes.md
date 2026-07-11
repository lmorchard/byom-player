# Session notes — Tracklist virtualization

**Issue:** [#39](https://github.com/lmorchard/byom-player/issues/39)
**Branch:** `tracklist-virtualization`
**Date:** 2026-07-11

## What was built

Virtualized the tracklist so playlists with thousands of tracks stay fast, and replaced
the linear background availability sweep with a viewport-driven checker.

1. **`AvailabilityQueue`** (`src/availability.ts`) — a gentle, de-duping, session-persistent
   availability checker. Replaces `sweepAvailability`. Checks one track at a time with a
   cooldown (cache hits skip it), never re-checks an index, no-op when the provider can't
   check.
2. **Pure helpers** — extracted `matchesFilter(track, query)` and `isOrphan(track)` as
   exported functions plus a `filteredRows` getter; decoupled the unit tests from
   `.tracklist li` DOM (they assert on state / pure functions now, since the virtualizer
   doesn't render rows under happy-dom).
3. **Virtualized rendering** — `<lit-virtualizer>` (`@lit-labs/virtualizer@^2.1.1`, the
   project's first runtime dep beyond `lit`) renders only the visible window (~35 of 8000
   rows). `renderRow` extracted; stable `keyFunction` = real track index.
4. **Viewport-driven prescan** — the virtualizer's `rangeChanged` event + a forward
   lookahead (10) around the current track feed the queue. The `⋯` pending glyph now means
   "currently queued/in-flight" (`checking: Set<number>`) rather than "sweep hasn't reached
   it." Results persist for the session.

## Before / after at 8000 tracks (`big-sonic-heaven-spy`-scale)

- **Before:** 8000 `<li>` laid out up front; every availability tick / filter keystroke
  re-diffed all 8000 rows; the prescan sweep was ~40 min (300ms × 8000).
- **After (verified live in chromium):** ~35 rows in the DOM at once, window shifts on
  scroll (mid-scroll shows ~Track 3976, end shows Track 8000), scroll height ~337k px,
  list capped at 60vh. Availability checks fire only for visible + near-playback tracks.
  Short playlists still size to content (no forced void). Screenshot:
  `huge-8000-loaded.png`.

## Two bugs the live verification caught (would not surface in happy-dom)

happy-dom has no layout engine, so `@lit-labs/virtualizer` neither windows nor fires
`rangeChanged` in unit tests. Live chromium verification (via `puppeteer-core` driving the
cached Playwright Chromium with `acceptInsecureCerts`, since the dev server is self-signed
HTTPS and firefox rejects it) caught two runtime-only defects in the Task 3 integration:

1. **List didn't scroll / collapsed.** A virtualizer is *not* a scroller by default — it
   sizes itself to its full virtual content and expects a scrolling *ancestor*. Task 3 put
   `overflow:auto` on the virtualizer and relied on flex to cap it; the element's inline
   `min-height: <fullSize>` blocked the flex item from shrinking, so it ballooned to 337k px
   and `.stage`'s `overflow:visible` let it spill — nothing scrolled. Adding the `scroller`
   attribute made it scroll but pinned it to the 150px default min-height (and the
   content-driven stage then collapsed to 150px). **Fix:** the library's default mode —
   wrap `<lit-virtualizer>` (non-scroller, sizes to content) in a `.tracklist` div that is
   the scroller (`flex:1 1 auto; min-height:0; overflow:auto`, capped by `.stage`'s 60vh).
   This restores the original content-driven sizing (compact short lists, scroll long ones).

2. **Far-jump centering scrolled to the end and blanked the list.** The deprecated
   `LitVirtualizer.scrollToIndex` is just `element(index)?.scrollIntoView()`, which can't
   resolve an index that isn't currently rendered. A **shuffle** advance jumps `currentIndex`
   to a far, unrendered row — so centering scrolled to the absolute end and rendered 0 rows.
   **Fix:** since rows are fixed-height, `centerActiveTrack` now computes the scroll offset
   arithmetically (`pos * rowHeight - (clientHeight - rowHeight)/2`) on the scroller — works
   for any index. Smooth scroll for nearby nudges (next/prev), instant for far jumps
   (shuffle) to avoid animating across thousands of rows. Verified: idx 4000 → centered on
   Track 3971–4029; idx 7990 → 7961–8000; idx 10 → top.

## API confirmations (`@lit-labs/virtualizer@2.1.1`)

- `rangeChanged` event: numeric `first`/`last` on the event, **non-bubbling** (listener must
  stay on the element). `first`/`last` are positions within the *filtered* items → map to
  real track indices via `filteredRows[pos].i`.
- A virtualizer is not a scroller unless given the `scroller` attribute; if you use `scroller`
  you must size it explicitly (default min-height 150px). We chose the ancestor-scroller
  (default) mode instead.
- `scrollToIndex` is a deprecated 0.x shim (`element(i)?.scrollIntoView`) — unreliable for
  off-screen indices; we don't use it.

## Follow-ups (out of scope for #39)

- Provider-side resolution batching for huge playlists (noted in #39 "out of scope").
- Minor test-comment cleanup: a couple of `ByomPlayer.test.ts` comments still say "sweep"
  after the queue rewrite (tracked in the SDD progress ledger's minor-findings list).
- The 150px scroller-mode caveat and the deprecated `scrollToIndex` are documented here in
  case a future change reaches for them.

## Verification

- Unit: `npm test` → 283 passing (queue logic, pure helpers, row-state, availability wiring).
- `npx tsc --noEmit` clean; `npm run build` OK (`dist/byom-player.js` 172.66 kB / gzip 44.86 kB);
  `npm run lint` clean.
- Live (chromium): windowing, scroll, content-driven sizing (huge + short), and far/near
  centering all confirmed against the generated 8000-track fixture.
