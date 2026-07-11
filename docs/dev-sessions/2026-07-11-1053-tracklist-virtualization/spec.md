# Spec — Tracklist virtualization for very long playlists

**Issue:** [#39](https://github.com/lmorchard/byom-player/issues/39)
**Date:** 2026-07-11

## Problem

`ByomPlayer.render()` maps every filtered track to an `<li>` (ByomPlayer.ts:751). For
very long playlists (e.g. `big-sonic-heaven-spy.yaml`, 8000+ tracks) two costs compound:

1. **Initial layout** — the browser lays out all 8000 rows (grid + nested spans + lazy
   `<img>`) up front.
2. **Re-render churn** — every state tick re-runs the template over *all* rows. The
   background availability sweep does `this.availability = new Map(...)` per track
   (ByomPlayer.ts:389), so the whole list re-diffs on each sweep step, plus on every
   play/index change and filter keystroke.

Separately, the prescan sweep runs at `prescanDelayMs` (300ms) per track — ~40 minutes
for 8000 tracks.

## Goals

- Only the visible window (+ overscan) is ever in the DOM.
- Sweep / index / filter re-renders touch only visible rows.
- Availability checks are bounded to what the user actually looks at (+ near playback),
  not a linear full sweep.
- Preserve current behavior: filtering, scroll-to-active centering, `part` styling hooks,
  and the available/unavailable/pending/orphan/active row states.

## Non-goals

- Provider-side resolution batching or other 8000-track scaling concerns beyond the
  tracklist DOM and the prescan.
- Changing the JSPF data contract or the controller's playback/skip logic.

## Design

### Part 1 — Virtualize the tracklist with `@lit-labs/virtualizer`

- Add `@lit-labs/virtualizer` as a runtime dependency (the project's first beyond `lit`).
- Use the **`<lit-virtualizer>` element** (not the bare `virtualize` directive) because it
  exposes `scrollToIndex(index, position)` and the `rangeChanged` event we need.
- Extract the inline row template (ByomPlayer.ts:756–787) into a
  `renderRow(t: Track, i: number, playing: boolean)` method, used as `renderItem`.
- Configure:
  - `.items = rows` — the filtered `{ t, i }[]` array (unchanged shape; `i` = real
    `pl.tracks` index).
  - `.keyFunction = (row) => row.i` — stable key = real track index, so DOM reuse survives
    filter and sweep churn.
  - `.renderItem = (row) => this.renderRow(row.t, row.i, playing)`.
- Style `<lit-virtualizer>` as today's `.tracklist` (the scroller: `overflow:auto`,
  `flex:1 1 auto`, `min-height:0` inside `.stage`). Keep `part="tracklist"`. It is a custom
  element rather than a real `<ol>`, so add `role="list"` on it and `role="listitem"` on
  each row `<li>` to preserve semantics.

**Centering.** Replace `centerActiveTrack()`'s manual `scrollBy` math (ByomPlayer.ts:419)
with the virtualizer's scroll API:

- On `currentIndex` change, compute the active track's **position within the filtered
  `rows`** (`rows.findIndex(r => r.i === currentIndex)`).
- If found (≥ 0), call `virtualizer.scrollToIndex(pos, 'center')`.
- If not found (active track filtered out), no-op — matches today's "active row not in the
  filtered DOM" case.
- Guard for environments without layout (tests): the element/method may be absent — call
  optionally, as `centerActiveTrack` does today with `scrollBy?.`.

### Part 2 — Viewport-driven prescan

Replace the linear full sweep with a bounded, viewport-driven availability queue. **Single
code path for all playlist sizes** (small lists are usually fully visible, so effectively
still eager). Results **persist for the session** — once a track's status is known it stays
in `this.availability`; scrolling back never re-checks.

- Learn the visible index range from `<lit-virtualizer>`'s `rangeChanged`
  (`{ first, last }`) event.
- Maintain a gentle, rate-limited **check queue**:
  - Candidates = visible-but-unknown tracks (status not in `this.availability` and not in
    `failed`), plus a small fixed window around `currentIndex` (near-playback lookahead).
  - Process one at a time with `prescanDelayMs` cooldown; **cache-hits skip the cooldown**
    (mirrors `sweepAvailability`'s `isResolutionCached` behavior).
  - On result, `this.availability = new Map(this.availability).set(i, status)` and, for
    `'unavailable'`, `this.controller?.markUnavailable(i, true)` — same as today.
  - De-dupe: never enqueue an index already known or already queued.
- Reset/abort on playlist or provider switch (same points that call `startSweep` /
  `sweepAbort.abort()` today). `handleProviderReset()` clears `availability` and re-arms the
  queue.
- Tracks never scrolled to stay `'unknown'`; play-time resolution + the `failed` set already
  handle unknowns, and shuffle-skip still works for everything checked.

This supersedes the eager `startSweep()` → `sweepAvailability()` linear walk. `scanning`
state (used for the `pending` row glyph `⋯`) is repurposed to mean "this row is queued /
in-flight" rather than "the linear sweep hasn't reached it yet."

### Module boundaries

- **`ByomPlayer`** owns the virtualizer element, wires `rangeChanged` → queue, and maps
  `currentIndex` → filtered position for centering.
- **Availability queue** — a small, testable unit (new module or a focused rewrite of
  `availability.ts`) that, given a provider + a set of requested indices, checks them
  gently, de-dupes, rate-limits, honors cache-hits, reports results via callback, and stops
  on abort. Pure-ish: no DOM, no layout — unit-testable under happy-dom.
- **`renderRow` / row-state helpers** (`trackClasses`, `trackState`) stay pure functions of
  `(index, orphaned, state maps)` — unit-testable.

## Testing

happy-dom has no layout engine, so `@lit-labs/virtualizer` cannot truly window under
Vitest. Existing tests that count/inspect `.tracklist li` may see all-or-nothing rows and
need adjusting.

- **Unit (Vitest / happy-dom):**
  - Availability-queue logic: de-dup, rate-limit ordering, cache-hit-skips-cooldown,
    abort stops promptly, results reported once per index, requested-set → checks.
  - Row-state helpers (`trackClasses`, `trackState`) across the state combinations.
  - Centering index-mapping helper (filtered position of `currentIndex`, incl. filtered-out
    → no-op) as a pure function so it's testable without layout.
  - Adjust existing `ByomPlayer.test.ts` assertions that assume all rows are present.
- **Live (chromium, dev server):** windowing (only a window of rows in the DOM), smooth
  scroll, scroll-to-active centering on next/prev, filter interaction, and viewport-driven
  availability marks — against a large generated playlist (thousands of tracks). Per the
  project's self-signed-HTTPS + Playwright setup (chromium with `ignoreHTTPSErrors`).

## Open risks

- `<lit-virtualizer>` integration inside the shadow DOM + `.stage` flex scroller — confirm
  it scrolls within the component and never the host page (today's invariant).
- `rangeChanged` event shape / timing across filter changes — ensure a filter that shrinks
  `rows` re-arms the queue for the newly-visible set.
- happy-dom rendering behavior of the virtualizer — determine whether existing DOM-counting
  tests break, and adjust rather than weaken them.
