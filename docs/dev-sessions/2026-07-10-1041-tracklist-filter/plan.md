# Tracklist search/filter Implementation Plan

**Goal:** Add a client-side text filter above the tracklist that narrows visible rows by title/artist/album, without touching playback state.

**Approach:** Add a reactive `filterQuery` `@state` field; compute a derived filtered view in `render()` that carries each track's real `pl.tracks` index into `selectTrack(i)`/`trackClasses(i, …)`; render an empty-state message when a non-empty query matches nothing. Then add a clear (×) button and keyboard affordances (`/` to focus, `Esc` to clear+blur).

**Tech stack:** Lit (LitElement, `html`/`css`/`nothing`), TypeScript, Vitest + happy-dom.

---

## Phase 1: Filtering core

Adds the filter input, reactive query state, derived filtered rows (real index preserved for selection), and the no-matches empty state. This is the full end-to-end filter.

**Files:**
- Modify: `src/ByomPlayer.ts` — import `Track` type; add `filterQuery` state; add `matchesFilter` + `onFilterInput`; rework the tracklist render block to filter; add empty-state; add CSS for `.filter-row`/`.filter-input`/`.no-matches`.
- Test: `src/ByomPlayer.test.ts` — add `album` to a fixture track; add filtering tests.

**Key changes:**
- Import: `import type { Playlist, Track } from './types';` (currently only `Playlist`).
- New state: `@state() private filterQuery = '';`
- New methods:

```ts
private matchesFilter(t: Track): boolean {
  const q = this.filterQuery.trim().toLowerCase();
  if (!q) return true;
  return (
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    (t.album?.toLowerCase().includes(q) ?? false)
  );
}

private onFilterInput(e: Event): void {
  this.filterQuery = (e.currentTarget as HTMLInputElement).value;
}
```

- Render: insert a filter row immediately before `<ol class="tracklist">`, and replace the row-mapping block with a derived-and-filtered version. `q` is the trimmed query used only for the empty-state test/message:

```ts
const q = this.filterQuery.trim();
const rows = pl.tracks
  .map((t, i) => ({ t, i }))
  .filter(({ t }) => this.matchesFilter(t));
```

```html
<div class="filter-row">
  <input
    class="filter-input"
    type="text"
    placeholder="Filter tracks…"
    .value=${this.filterQuery}
    aria-label="Filter tracks"
    @input=${this.onFilterInput}
  />
</div>
<ol class="tracklist ${this.hasVideo ? 'with-video' : ''}">
  ${rows.map(({ t, i }) => {
    const orphaned = t.syncState?.spotifyPresent === false;
    return html`
      <li class=${this.trackClasses(i, orphaned)} @click=${() => this.selectTrack(i)}>
        <span class="t-title">${t.title}</span>
        <span class="t-artist">${t.artist}</span>
      </li>
    `;
  })}
</ol>
${
  rows.length === 0 && q
    ? html`<p class="no-matches">No tracks match "${q}"</p>`
    : nothing
}
```

- CSS (append inside `static styles`):

```css
.filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.filter-row .filter-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.07);
  color: var(--byom-text);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  font: inherit;
  font-size: 0.9rem;
}
.filter-row .filter-input:focus {
  outline: none;
  border-color: var(--byom-accent);
}
.no-matches {
  opacity: 0.6;
  font-size: 0.85rem;
  padding: 0.5rem;
  margin: 0;
}
```

**Tests to add** (mirror existing `mount()`/`lis()` idiom, `src/ByomPlayer.test.ts:61-112`). Add `album: 'Greatest Hits'` to fixture track C (`:56`) — harmless to existing assertions. Helper to set the query:

```ts
async function setFilter(el: ByomPlayer, value: string): Promise<void> {
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
}
```

- `filters by title (case-insensitive)`: mount, `setFilter(el, 'bb')` → exactly 1 row, title 'B' (matches artist 'bb'). For a title-specific case use a query that only appears in a title; with the A/B/C fixture, `setFilter(el, 'bb')` is unambiguous. Also assert case-insensitivity: `setFilter(el, 'BB')` → same 1 row.
- `filters by artist`: `setFilter(el, 'cc')` → 1 row, title 'C'.
- `filters by album`: `setFilter(el, 'greatest')` → 1 row, title 'C' (album match, even though album isn't shown).
- `empty query shows all`: `setFilter(el, 'x')` then `setFilter(el, '')` → `lis(el)` length 3.
- `clicking a filtered row plays the correct real track`: `setFilter(el, 'cc')`, click the single visible row, `settle(el)`, assert `provider.loadedIndex` contains `'C'` and that row is `.active`.
- `shows a no-matches message when nothing matches`: `setFilter(el, 'zzz')` → `lis(el)` length 0 and `el.shadowRoot!.querySelector('.no-matches')` textContent contains `zzz`.

**Verification — automated:**
- [x] `npm run lint` passes
- [x] `npm test` passes (new filter tests + existing 198 green → 203 total)
- [x] `npm run build` passes (tsc + vite build)

**Verification — manual:**
- [x] In the dev app (Playwright/chromium), typing "love" over a 100-track playlist narrows to 3 rows; clearing restores all 100; a no-match query shows the message at the top of the list area.

---

## Phase 2: Clear button + keyboard shortcuts

Adds a clear (×) button (shown only when there's a query), a global `/` shortcut to focus the field, and `Esc` to clear + blur.

**Files:**
- Modify: `src/ByomPlayer.ts` — add `clearFilter`, `onFilterKeydown`, `onGlobalKeydown` (arrow fn field), `isEditable`, `deepActiveElement`; attach/detach the global listener in `connectedCallback`/`disconnectedCallback`; render the clear button; add `.filter-clear` CSS.
- Test: `src/ByomPlayer.test.ts` — add clear-button, `/`-focus, and `Esc` tests.

**Key changes:**
- New methods:

```ts
private clearFilter(): void {
  this.filterQuery = '';
  this.renderRoot.querySelector<HTMLInputElement>('.filter-input')?.focus();
}

private onFilterKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    this.filterQuery = '';
    (e.currentTarget as HTMLInputElement).blur();
  }
}

// Deepest focused element, piercing shadow roots (focus inside a shadow tree
// shows up as the host in document.activeElement).
private deepActiveElement(): Element | null {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

private isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}

// Global '/' focuses the filter, unless the user is already typing in a field
// (including our own filter input — then '/' types normally).
private onGlobalKeydown = (e: KeyboardEvent): void => {
  if (e.key !== '/') return;
  if (this.isEditable(this.deepActiveElement())) return;
  e.preventDefault();
  this.renderRoot.querySelector<HTMLInputElement>('.filter-input')?.focus();
};
```

- Lifecycle: in `connectedCallback` (after `super.connectedCallback()`), `document.addEventListener('keydown', this.onGlobalKeydown);`. In `disconnectedCallback`, `document.removeEventListener('keydown', this.onGlobalKeydown);`.
- Render: wire `@keydown=${this.onFilterKeydown}` on the `.filter-input`; add the clear button after the input inside `.filter-row`:

```html
${
  this.filterQuery
    ? html`<button class="filter-clear" @click=${this.clearFilter} aria-label="Clear filter">×</button>`
    : nothing
}
```

- CSS (append inside `static styles`):

```css
.filter-row .filter-clear {
  cursor: pointer;
  background: transparent;
  border: none;
  color: var(--byom-text);
  opacity: 0.6;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0 0.3rem;
}
.filter-row .filter-clear:hover {
  opacity: 1;
}
```

**Tests to add:**
- `clear button empties the query and restores all rows`: `setFilter(el, 'cc')` → 1 row + clear button present; click `.filter-clear`; `await el.updateComplete`; `lis(el)` length 3 and `filterQuery` empty (assert via `.filter-input` value `''`).
- `clear button hidden when query is empty`: on mount, `el.shadowRoot!.querySelector('.filter-clear')` is null.
- `pressing / focuses the filter input`: dispatch `document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))`; assert the filter input is focused (`el.shadowRoot!.activeElement === input`). If happy-dom doesn't track shadow `activeElement` on `.focus()`, fall back to spying: replace `input.focus` with a `vi.fn()` before dispatch and assert it was called.
- `Escape clears the query and blurs`: `setFilter(el, 'cc')`; dispatch `input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`; `await el.updateComplete`; assert `lis(el)` length 3 and query empty.
- `removes the global keydown listener on disconnect`: spy `document.removeEventListener`, remove the element (`el.remove()`), assert it was called with `'keydown'`. (Mirrors the dispose test idiom around `src/ByomPlayer.test.ts:254`.)

**Verification — automated:**
- [x] `npm run lint` passes
- [x] `npm test` passes (209 total)
- [x] `npm run build` passes

**Verification — manual:**
- [x] In the dev app (Playwright/chromium): pressing `/` with focus outside the field focuses the filter; typing then `Esc` clears + restores the list; clear (×) appears only with a query.

---

## Notes

- **Scope guard (from spec "What we're NOT doing"):** no state-based filtering, no fuzzy/tokenized matching, no highlighting, no persistence, no debouncing, no schema changes, no unrelated control refactors.
- **One commit per phase**, message `Phase N: <name>`; squashed before PR.
- `centerActiveTrack` needs no change — it already returns early when `li.active` is absent (`src/ByomPlayer.ts:153-163`), so filtering the active track out is safe.
