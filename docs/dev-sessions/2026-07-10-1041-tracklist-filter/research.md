# Research — tracklist rendering & selection (issue #30)

Documentarian findings. All refs relative to worktree root.

## 1. Tracklist rendering
- Rendered in `render()` at `src/ByomPlayer.ts:274-284`.
- `<ol class="tracklist ${this.hasVideo ? 'with-video' : ''}">` (`:274`); `with-video` shortens max-height (styles `:362-371`).
- Iterates `pl.tracks.map((t, i) => ...)` where `pl = this.playlist` (`:218`, `:275`).
- Each `<li>` (`:278-281`) shows `<span class="t-title">${t.title}</span>` (`:279`) and `<span class="t-artist">${t.artist}</span>` (`:280`).
- **Album (`t.album`) is NOT rendered** — exists on type (`src/types.ts:12`), populated by loader (`src/manifest.ts:35`), but unused in render.
- Per-row `orphaned = t.syncState?.spotifyPresent === false` (`:276`).
- Row classes via `trackClasses(i, orphaned)` (`:278`, def `:203-215`): `active` when `index === this.currentIndex` (`:208`); `orphan`, `unavailable`, `pending`.
- `.active` styling `:379-382`.

## 2. Track selection end-to-end
- Row click: `@click=${() => this.selectTrack(i)}` (`:278`); `i` is index into `pl.tracks` (matches `currentIndex` semantics).
- `selectTrack(index)` → `void this.controller?.start(index)` (`:165-167`).
- `PlaybackController.start(trackIndex)` (`src/controller.ts:67-71`): sets `pos = posOf(trackIndex)` then `loadCurrent()`. `posOf` = `order.indexOf(trackIndex)` (`:129-132`).
- Exposed current index: `get index()` = `order[pos] ?? 0` (`src/controller.ts:60-63`).
- Controller → component via `onChange` → `syncFromController()` (`:102`, `:133-143`), sets `this.currentIndex = this.controller.index`.
- **Takeaway:** `selectTrack` needs the REAL playlist index. A filtered view must preserve real index per row.

## 3. Center-the-playing-track scroll
- Triggered in `updated(changed)`: `if (changed.has('currentIndex')) this.centerActiveTrack()` (`:145-149`).
- `centerActiveTrack()` (`:153-163`): queries `.tracklist` then `li.active` within it; **returns early if either missing** (`:156`). Uses `getBoundingClientRect` + `list.scrollBy?.(...)`.
- **Takeaway:** already tolerates the active row being absent (querySelector null → early return). Filtering active track out won't throw.

## 4. Controls near the header
- Header block `:222-273`: `<header>` (`:222-225`), `<div class="now-playing">` (`:226-233`), `<div class="progress-row">` (`:234-248`), `<div class="controls">` prev/playpause/next/shuffle (`:249-264`), `<div class="status">` (`:265-273`).
- The `<ol class="tracklist">` follows at `:274`.
- Lit conventions: `@customElement('byom-player')` (`:12`); `@state()` fields incl. `playlist`, `currentIndex`, ... `hasVideo` (`:31-41`); handlers are bound methods (`this.togglePlay`); `nothing` for conditionals; static `css` `:289-401`.

## 5. Keyboard handling
- **None exists.** No keydown/keyup/keypress, no document/window listeners. Interaction is only `@click`/`@input`/`@change`. `disconnectedCallback` (`:53-59`) only aborts sweep + disposes controller.

## 6. Types
- `src/types.ts`: `Track` = `title`, `artist`, optional `album?`, `isrc?`, `durationMs?`, `spotifyUrl?`, `syncState?`, `resolvedIds?` (`:9-20`). `Playlist` = `title`, optional `creator?`/`dateCreated?`, `tracks: Track[]` (`:22-27`).

## 7. Tests (`src/ByomPlayer.test.ts`)
- Vitest + happy-dom (`vite.config.ts`); run `vitest run` (`package.json:17`).
- Component via side-effect import `import './ByomPlayer'` (`:2`).
- `mount()` (`:61-72`): createElement, set `src`, inject `providerFactory`, `skipDelayMs=0`, append, await setTimeout(0) + `updateComplete`.
- Query helper `lis(el)` = `Array.from(el.shadowRoot!.querySelectorAll('.tracklist li'))` (`:74`); `settle(el)` (`:77-80`).
- `fetch` mocked in `beforeEach` returning `jspf` fixture (3 tracks A/B/C; B orphaned) (`:45-59`, `:83-87`).
- Existing row tests: one row per track (`:93-97`); orphan class (`:99-103`); "clicking a track selects and plays it, moving .active" clicks `lis(el)[2]` (`:105-112`).
- No filter/search input or test exists yet.
