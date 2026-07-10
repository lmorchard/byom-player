# Tracklist search/filter Spec

**Goal:** Let a listener type a few characters to instantly narrow the current playlist's tracklist to matching songs, so a track can be found in a long playlist without scrolling.

**Source:** https://github.com/lmorchard/byom-player/issues/30

## Current state

- The tracklist renders in `render()` by iterating `pl.tracks.map((t, i) => ...)` at `src/ByomPlayer.ts:274-284`; each `<li>` shows `t.title` and `t.artist` (`:279-280`). Album is on the type (`src/types.ts:12`) but not rendered.
- Row click selects by real playlist index: `@click=${() => this.selectTrack(i)}` (`:278`) → `selectTrack(index)` → `controller.start(index)` (`:165-167`), and `posOf` maps that index into the play order (`src/controller.ts:129-132`). So selection depends on the **real** `pl.tracks` index.
- `.active` row = `currentIndex === i` (`src/ByomPlayer.ts:203-215`); `centerActiveTrack()` queries `li.active` and returns early if absent (`:153-163`) — so it already tolerates the active track being filtered out.
- Component is a Lit element with `@state()` fields (`:31-41`), `nothing` conditionals, static `css` (`:289-401`). No keyboard listeners exist anywhere (`research.md` §5).
- See `research.md` for full `file:line` detail.

## Desired end state

- A text input sits directly above the `<ol class="tracklist">`, styled to match the existing controls.
- Typing filters the visible rows to tracks whose **title, artist, or album** contain the query (case-insensitive substring; whitespace-trimmed). Empty query shows all tracks.
- Filtering is a **derived view only**: `pl.tracks`, playback order, `currentIndex`, prev/next, and shuffle are all unaffected. Playback continues regardless of what's filtered.
- Clicking a visible (filtered) row still selects and plays the correct track (maps filtered row → real `pl.tracks` index).
- A clear (×) button appears in/next to the field when there's a query; clicking it empties the query and refocuses the field.
- Keyboard: pressing `/` anywhere in the player focuses the filter field (and does not type `/` into it); `Esc` while the field is focused clears the query and blurs.
- When a non-empty query matches zero tracks, the list area shows a muted message: `No tracks match "<query>"`.

## Design decisions

- **Decision:** Match against title + artist + album, case-insensitive substring.
  - **Why:** Widest useful net; album data is already loaded (`src/manifest.ts:35`) so it's free to include and helps find "that song from album X."
  - **Rejected:** title+artist only — more predictable (every match visible in-row) but misses album-driven searches.

- **Decision:** Filter as a derived view computed in `render()` — build `pl.tracks.map((t, i) => ({ t, i })).filter(matches)` and render from that, carrying the real index `i` into `selectTrack(i)` and `trackClasses(i, ...)`.
  - **Why:** Preserves all playback indices with zero mutation of `pl.tracks` or controller state, per the issue's core constraint. Keeps the change contained to `render()` + one `@state` field.
  - **Rejected:** Mutating/replacing the playlist array, or hiding rows via CSS (leaves stale DOM and complicates the empty-state).

- **Decision:** New `@state() private filterQuery = ''`, updated from the input's `@input` handler. Matching normalizes via `filterQuery.trim().toLowerCase()`.
  - **Why:** Standard Lit reactive-state pattern already used throughout the component (`:31-41`); re-renders automatically on change.

- **Decision:** `/` focus shortcut via a single `document`-level `keydown` listener attached in `connectedCallback` and removed in `disconnectedCallback`. The handler ignores the event when the active element is already an editable element (INPUT / TEXTAREA / contenteditable), and calls `preventDefault()` before focusing so `/` isn't typed into the field.
  - **Why:** No keyboard handling exists yet (`research.md` §5); document-level is needed because focus may be anywhere. The editable-element guard prevents hijacking typing elsewhere — if the user is already in a text field (including the filter field itself), `/` types normally instead of being intercepted.
  - **Rejected:** No shortcut (loses the quick-focus affordance the issue asked about); element-scoped listener (wouldn't fire unless the component already had focus).

- **Decision:** `Esc` handled via the input's own `@keydown` (not the global listener): clears query + blurs.
  - **Why:** Esc only matters while the field is focused; keeping it local avoids swallowing Esc globally.

- **Decision:** Empty-state message rendered in place of the `<ol>` rows (or as a single non-`<li>` element) only when `filterQuery.trim()` is non-empty and zero rows match.
  - **Why:** Distinguishes "filter matched nothing" from "playlist is empty"; avoids a blank area reading as a bug.

## Patterns to follow

- Reactive state + auto re-render: `@state()` fields at `src/ByomPlayer.ts:31-41`.
- Row rendering / class computation to mirror: `src/ByomPlayer.ts:274-284` and `trackClasses` (`:203-215`) — keep passing the real index.
- Control markup + styling idiom (buttons/inputs, `@click`/`@input` handlers, static `css`): `src/ByomPlayer.ts:234-264`, styles `:289-401`.
- Lifecycle attach/detach idiom for the global listener: `connectedCallback` (`:48-51`) / `disconnectedCallback` (`:53-59`).
- Test idiom: Vitest + happy-dom, `mount()` (`src/ByomPlayer.test.ts:61-72`), `lis(el)` row query (`:74`), fetch-mocked `jspf` fixture (`:45-59`, `:83-87`), and the existing "clicking a track selects and plays it" test (`:105-112`) as the model for filtered-click assertions.

## What we're NOT doing

- No filtering by orphaned/resolved/availability **state** (e.g. "show only orphans") — plain text filter only (issue defers this).
- No fuzzy matching, tokenized/multi-term ranking, or match highlighting — plain case-insensitive substring.
- No manifest/schema/type changes; album stays unrendered in rows (matched but not displayed).
- No change to playback order, shuffle, prev/next, `currentIndex`, or controller behavior.
- No persistence of the query (not saved to settings/localStorage; resets on reload).
- No debouncing — client-side filter over an in-memory array is instant.
- No refactor of unrelated control markup or styles.

## Open questions

None blocking. (Album matches but isn't shown in-row — accepted trade-off per the match-fields decision.)
