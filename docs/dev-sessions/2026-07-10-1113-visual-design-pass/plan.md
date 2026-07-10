# Visual/UX Design Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the functional-but-plain `<byom-player>` into a themed, skinnable component — a clean `::part()`/CSS-variable skinning surface, one polished default skin, auto light/dark, and a handful of color themes with an in-panel picker — without regressing behavior.

**Architecture:** One clean Shadow-DOM structure exposed via `part` attributes (the skin contract) and a 9-token CSS-variable palette (the theme contract). Skins are external stylesheets targeting parts; themes are `:host([theme])` palette blocks baked into `static styles`, defaulting to a light/dark pair via `prefers-color-scheme`. Track state is exposed as `data-state` on the `track` part. All work lives in `src/ByomPlayer.ts` plus a `theme` field in `src/settings.ts`.

**Tech Stack:** Lit 3, TypeScript, vitest + happy-dom.

## Global Constraints

- Behavior tests must stay green: `npx vitest run` (currently ~226 tests).
- Preserve existing track-row **classes** (`.active`, `.orphan`, `.unavailable`, `.pending`) — existing tests assert them. Add `part`/`data-state` alongside, do not replace.
- happy-dom: wrap a bare `${expr}` child in a container element; no global `localStorage` in tests (`src/test-setup.ts` installs one). Suites touching settings call `localStorage.clear()` in `beforeEach`.
- Host inline `--byom-*` overrides must keep working (never use `!important` on token consumers).
- Lint/format clean: `npm run lint`. Build clean: `npm run build`.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Palette hexes and exact spacing are FIRST-DRAFT values to tune live with Les; get them structurally correct, not pixel-final.

## File Structure

- **Modify** `src/settings.ts` — add `theme?: string` to `UserSettings`.
- **Modify** `src/ByomPlayer.ts` — `theme` property; theme apply-on-connect + persist; `part`/`data-state` in template; token vocabulary + theme palettes + all treatments in `static styles`; theme picker in settings.
- **Modify** `src/ByomPlayer.test.ts` — new tests for `data-state`, `part` surface, theme attribute/persistence, picker.
- **Modify** `src/settings.test.ts` — theme round-trip.
- **Create** `docs/dev-sessions/2026-07-10-1113-visual-design-pass/example-skin.css` — throwaway proof that an external skin restyles via `::part()` only.
- **Modify** `README.md` — "Theming & skins" section (token table + parts list).

---

### Task 1: Persist a `theme` in user settings

**Files:**
- Modify: `src/settings.ts`
- Test: `src/settings.test.ts`

**Interfaces:**
- Produces: `UserSettings.theme?: string` — round-trips through `loadSettings`/`saveSettings` (which already pass unknown fields through via `{ ...parsed }`).

- [ ] **Step 1: Write the failing test**

Add to `src/settings.test.ts`:

```ts
it('round-trips a theme selection', () => {
  const storage = fakeStorage();
  saveSettings({ providers: {}, theme: 'midnight' }, storage);
  expect(loadSettings(storage).theme).toBe('midnight');
});
```

(Reuse the file's existing `fakeStorage()` helper. If none exists there, use `localStorage` and `localStorage.clear()` in a `beforeEach`, matching that suite's style.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/settings.test.ts`
Expected: FAIL — `theme` is not on the `UserSettings` type (tsc/type error) or `undefined` at runtime.

- [ ] **Step 3: Add the field**

In `src/settings.ts`, add to the `UserSettings` interface:

```ts
export interface UserSettings {
  provider?: string;
  debug?: boolean;
  /** Selected named theme (e.g. 'midnight'); '' or absent = Auto (follow OS). */
  theme?: string;
  providers: Record<string, Record<string, string>>;
}
```

No logic change needed — `loadSettings` already spreads `...parsed`, so `theme` survives the round-trip.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts src/settings.test.ts
git commit -m "feat(settings): persist a theme selection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `theme` property + built-in theme palettes

Adds the reflected `theme` attribute, applies a persisted theme on connect, commits a theme change like the provider select (immediate), and defines the token vocabulary + `:host([theme])` palette blocks (auto light/dark default). This task establishes the theme contract; the picker UI is Task 6.

**Files:**
- Modify: `src/ByomPlayer.ts`
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Consumes: `UserSettings.theme` (Task 1).
- Produces: reflected `theme` attribute on the host; `applyTheme(name: string)` behavior via the `theme` property; token vocabulary `--byom-bg|surface|text|text-muted|accent|on-accent|border|font|border-radius`.

- [ ] **Step 1: Write the failing tests**

Add to `src/ByomPlayer.test.ts`:

```ts
it('reflects the theme property to a host attribute', async () => {
  const { el } = await mount();
  el.theme = 'midnight';
  await el.updateComplete;
  expect(el.getAttribute('theme')).toBe('midnight');
});

it('applies a persisted theme on connect', async () => {
  saveSettings({ providers: {}, theme: 'terminal' });
  const el = document.createElement('byom-player') as ByomPlayer;
  el.src = '/playlist.jspf.json';
  el.providerFactory = () => new ControllableProvider();
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  expect(el.getAttribute('theme')).toBe('terminal');
});
```

Add the import at the top of the test file if not present:

```ts
import { saveSettings } from './settings';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ByomPlayer.test.ts -t theme`
Expected: FAIL — no `theme` property; attribute never set.

- [ ] **Step 3: Add the reflected property + apply-on-connect**

In `src/ByomPlayer.ts`, add to the public properties (near `provider`):

```ts
/** Selected named theme; '' = Auto (follow OS via prefers-color-scheme). */
@property({ reflect: true }) theme = '';
```

In `connectedCallback`, after `this.settings = loadSettings();`, add:

```ts
// Persisted theme wins over the host default (mirrors the provider rule).
if (this.settings.theme) this.theme = this.settings.theme;
```

Reflect an empty `theme` cleanly: an empty string still reflects as `theme=""`, which is fine — no `:host([theme=""])` block exists, so it falls through to the auto default. (Lit reflects `''` as an empty attribute; the `:host([theme="x"])` selectors simply won't match.)

- [ ] **Step 4: Add the token vocabulary + palette blocks to `static styles`**

Replace the current `:host { … }` token block (the `--byom-*` declarations only — keep the `display/background/color/...` rules) with the expanded vocabulary and add the palette blocks immediately after `:host`. First-draft hexes (tune live):

```css
:host {
  /* Auto light default */
  --byom-bg: #f7f7f5;
  --byom-surface: #ffffff;
  --byom-text: #1a1a1a;
  --byom-text-muted: #6b6b6b;
  --byom-accent: #3b5bdb;
  --byom-on-accent: #ffffff;
  --byom-border: #d9d9d6;
  --byom-font: system-ui, sans-serif;
  --byom-border-radius: 8px;

  display: block;
  background: var(--byom-bg);
  color: var(--byom-text);
  font-family: var(--byom-font);
  border-radius: var(--byom-border-radius);
  padding: 1rem;
  position: relative;
}
/* Auto dark default = Midnight */
@media (prefers-color-scheme: dark) {
  :host {
    --byom-bg: #1e1e1e;
    --byom-surface: #2a2a2a;
    --byom-text: #ffffff;
    --byom-text-muted: #a0a0a0;
    --byom-accent: #ff0055;
    --byom-on-accent: #14141a;
    --byom-border: #3a3a3a;
  }
}
:host([theme='daylight']) {
  --byom-bg: #f7f7f5; --byom-surface: #ffffff; --byom-text: #1a1a1a;
  --byom-text-muted: #6b6b6b; --byom-accent: #3b5bdb; --byom-on-accent: #ffffff;
  --byom-border: #d9d9d6;
}
:host([theme='midnight']) {
  --byom-bg: #1e1e1e; --byom-surface: #2a2a2a; --byom-text: #ffffff;
  --byom-text-muted: #a0a0a0; --byom-accent: #ff0055; --byom-on-accent: #14141a;
  --byom-border: #3a3a3a;
}
:host([theme='terminal']) {
  --byom-bg: #0b0f0b; --byom-surface: #121812; --byom-text: #c8f7c8;
  --byom-text-muted: #5a8a5a; --byom-accent: #39ff14; --byom-on-accent: #06120a;
  --byom-border: #1f3a1f;
}
:host([theme='sunset']) {
  --byom-bg: #241a17; --byom-surface: #2f221d; --byom-text: #f5e6dc;
  --byom-text-muted: #b08d7d; --byom-accent: #ff8c42; --byom-on-accent: #241a17;
  --byom-border: #4a352c;
}
:host([theme='paper']) {
  --byom-bg: #f4ecd8; --byom-surface: #fffaf0; --byom-text: #3a2f26;
  --byom-text-muted: #8a7a66; --byom-accent: #0f766e; --byom-on-accent: #fffaf0;
  --byom-border: #ddd0b8;
}
/* Stretch: Dracula */
:host([theme='dracula']) {
  --byom-bg: #282a36; --byom-surface: #343746; --byom-text: #f8f8f2;
  --byom-text-muted: #6272a4; --byom-accent: #bd93f9; --byom-on-accent: #282a36;
  --byom-border: #44475a;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/ByomPlayer.test.ts -t theme`
Expected: PASS. Then `npx vitest run` — full suite stays green.

- [ ] **Step 6: Commit**

```bash
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(theme): reflected theme attribute + token vocabulary + palettes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `part` surface + `data-state` on tracks

Add `part` attributes to every skinnable region, and `data-state` (alongside the existing classes) to each track row via `trackClasses`' sibling logic.

**Files:**
- Modify: `src/ByomPlayer.ts`
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Consumes: existing `trackClasses(index, orphaned)`.
- Produces: `trackState(index, orphaned): 'active' | 'orphan' | 'unavailable' | 'pending' | ''` returning the single dominant state for `data-state`; `part` attributes: `header title creator playlist now-playing progress seek controls control prev play next shuffle gear stage tracklist track video settings`.

- [ ] **Step 1: Write the failing tests**

Add to `src/ByomPlayer.test.ts`:

```ts
it('exposes a part surface for skins', async () => {
  const { el } = await mount();
  const parts = ['header', 'controls', 'tracklist', 'stage', 'progress'];
  for (const p of parts) {
    expect(el.shadowRoot!.querySelector(`[part~="${p}"]`), `part=${p}`).toBeTruthy();
  }
});

it('sets data-state on track rows', async () => {
  const { el } = await mount();
  // Row 1 (index 1) is the orphaned track in the fixture.
  expect(lis(el)[1].getAttribute('data-state')).toBe('orphan');
});

it('data-state=active follows the playing row', async () => {
  const { el } = await mount();
  (lis(el)[2] as HTMLElement).click();
  await settle(el);
  expect(lis(el)[2].getAttribute('data-state')).toBe('active');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ByomPlayer.test.ts -t "part surface|data-state"`
Expected: FAIL — no `part`/`data-state` attributes yet.

- [ ] **Step 3: Add a `trackState` helper**

In `src/ByomPlayer.ts`, add next to `trackClasses`. `active` dominates, then `unavailable`, then `orphan`, then `pending` (mirrors the visual precedence — a playing row reads as active even if orphaned):

```ts
private trackState(index: number, orphaned: boolean): string {
  const unavailable = this.failed.has(index) || this.availability.get(index) === 'unavailable';
  const pending = this.scanning && !this.availability.has(index) && !this.failed.has(index);
  if (index === this.currentIndex) return 'active';
  if (unavailable) return 'unavailable';
  if (orphaned) return 'orphan';
  if (pending) return 'pending';
  return '';
}
```

- [ ] **Step 4: Add `part`/`data-state` to the template**

Add `part=` attributes throughout `render()`/`renderSettings()` (keep all existing classes and handlers). Key edits:

```ts
<header class="header" part="header">
  <h2 class="title" part="title">${pl.title}</h2>
  ${pl.creator ? html`<p class="creator" part="creator">${pl.creator}</p>` : nothing}
</header>
```

Playlist select: `part="playlist"`. `now-playing` div: `part="now-playing"`. Progress row: `part="progress"`; the range input adds `part="seek"`. Controls container: `part="controls"`. Each button adds `control` plus its own name, e.g. `part="control prev"`, `part="control play"`, `part="control next"`, `part="control shuffle"`, `part="control gear"`. `.stage` → `part="stage"`; `.tracklist` → `part="tracklist"`; the `.video` div already has `part="video"`. Settings card: `part="settings"`.

Track row — add `part="track"` and `data-state`:

```ts
<li
  class=${this.trackClasses(i, orphaned)}
  part="track"
  data-state=${this.trackState(i, orphaned)}
  @click=${() => this.selectTrack(i)}
>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/ByomPlayer.test.ts`
Expected: PASS (new + existing green — classes preserved).

- [ ] **Step 6: Commit**

```bash
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(skin): part surface + data-state on track rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Apply the token vocabulary across component styles

Route existing hardcoded colors through the new tokens so every theme covers the whole component. CSS-only; verified by the suite staying green + browser.

**Files:**
- Modify: `src/ByomPlayer.ts` (`static styles`)

- [ ] **Step 1: Replace hardcoded colors with tokens**

In `static styles`:
- `.video { background: #000; }` → `background: var(--byom-surface);` (embed frame).
- Settings card `.settings { background: var(--byom-bg); border: 1px solid var(--byom-accent); }` → `background: var(--byom-surface); border: 1px solid var(--byom-border);`.
- Field inputs/selects `border: 1px solid var(--byom-accent)` → `var(--byom-border)`; keep `:focus` accent (add `.settings .field input:focus, .settings .field select:focus { border-color: var(--byom-accent); outline: none; }`).
- Playlist picker border `var(--byom-accent)` → `var(--byom-border)`.
- `.progress-row .time { opacity: 0.7; }` → `color: var(--byom-text-muted); opacity: 1;`.
- Accent-fill buttons (`.shuffle.on`, `.auth-btn`, `.apply`) `color: var(--byom-bg)` → `color: var(--byom-on-accent)`.
- `.refresh`, `.shuffle` outline `var(--byom-accent)` stays accent (intentional accent affordance).

- [ ] **Step 2: Run the suite**

Run: `npx vitest run`
Expected: PASS (no behavior change).

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/ByomPlayer.ts
git commit -m "refactor(theme): route component colors through the token vocabulary

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Track-state treatments (marker + color role)

Give each state a glanceable treatment beyond opacity, using pseudo-element markers on the `track` part so the template/tests are untouched.

**Files:**
- Modify: `src/ByomPlayer.ts` (`static styles`)

- [ ] **Step 1: Replace the `.tracklist li.*` state rules**

```css
.tracklist li {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem 0.3rem 0.75rem;
  border-left: 3px solid transparent; /* reserve the active bar's width */
  border-radius: calc(var(--byom-border-radius) / 2);
}
.tracklist li:hover {
  background: color-mix(in srgb, var(--byom-text) 8%, transparent);
}
.tracklist li.active {
  color: var(--byom-accent);
  font-weight: 600;
  border-left-color: var(--byom-accent);
  background: color-mix(in srgb, var(--byom-accent) 12%, transparent);
}
.tracklist li.orphan {
  color: var(--byom-text-muted);
}
.tracklist li.orphan .t-title::after {
  content: '↯';
  margin-left: 0.4rem;
  opacity: 0.8;
  font-size: 0.85em;
}
.tracklist li.unavailable {
  color: var(--byom-text-muted);
  text-decoration: line-through;
}
.tracklist li.unavailable .t-title::after {
  content: '✕';
  margin-left: 0.4rem;
  text-decoration: none;
  opacity: 0.7;
}
.tracklist li.pending {
  color: var(--byom-text-muted);
}
.tracklist li.pending .t-title::before {
  content: '⋯ ';
  color: var(--byom-accent);
}
```

(`color-mix` is supported in all current evergreen browsers; the component already targets modern browsers via Lit 3 / ES modules.)

- [ ] **Step 2: Run the suite**

Run: `npx vitest run`
Expected: PASS (classes unchanged; happy-dom ignores unsupported CSS).

- [ ] **Step 3: Commit**

```bash
git add src/ByomPlayer.ts
git commit -m "feat(states): distinct marker+color treatments for track states

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Theme picker in the settings panel

Add an Appearance control (Auto + named themes) at the top of the panel, wired to commit immediately like the provider select.

**Files:**
- Modify: `src/ByomPlayer.ts`
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Consumes: `commitSettings`, `openSettings`, `draft: UserSettings`, reflected `theme` (Task 2).
- Produces: `onDraftTheme(e)`; `THEMES` constant `['', 'daylight','midnight','terminal','sunset','paper','dracula']` with labels ('' → 'Auto').

- [ ] **Step 1: Write the failing tests**

```ts
it('theme picker changes the theme, persists it, and reflects the attribute', async () => {
  const { el } = await mount();
  el['openSettings']();
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('.theme-select') as HTMLSelectElement;
  expect(select).toBeTruthy();
  select.value = 'sunset';
  select.dispatchEvent(new Event('change'));
  await el.updateComplete;
  expect(el.getAttribute('theme')).toBe('sunset');
  expect(loadSettings().theme).toBe('sunset');
});
```

Ensure `loadSettings` is imported in the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ByomPlayer.test.ts -t "theme picker"`
Expected: FAIL — no `.theme-select`.

- [ ] **Step 3: Carry `theme` through the draft + commit**

In `openSettings`, add `theme: this.theme,` to the draft object. In `commitSettings`, add `theme: this.draft.theme,` to the `this.settings = { … }` object, and after `if (this.draft.provider) this.provider = this.draft.provider;` add:

```ts
this.theme = this.draft.theme ?? '';
```

Add the handler and constant:

```ts
private onDraftTheme(e: Event): void {
  this.draft = { ...this.draft, theme: (e.currentTarget as HTMLSelectElement).value };
  void this.commitSettings(); // theme applies immediately, like provider
}
```

Near the top of the file (module scope), add:

```ts
const THEMES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto' },
  { value: 'daylight', label: 'Daylight' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'paper', label: 'Paper' },
  { value: 'dracula', label: 'Dracula' },
];
```

- [ ] **Step 4: Add the Appearance field to `renderSettings`**

Immediately after the `.settings-head` block, before the Provider field:

```ts
<label class="field">
  <span>Appearance</span>
  <select class="theme-select" .value=${this.draft.theme ?? ''} @change=${this.onDraftTheme}>
    ${THEMES.map(
      (t) => html`<option value=${t.value} ?selected=${t.value === (this.draft.theme ?? '')}>
        ${t.label}
      </option>`,
    )}
  </select>
</label>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/ByomPlayer.test.ts` then `npx vitest run`
Expected: PASS across the board.

- [ ] **Step 6: Commit**

```bash
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(theme): appearance picker in the settings panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Structural knobs — stage height + modal height

Content-driven stage with a cap; modal height decoupled from the stage. Layout isn't observable under happy-dom, so this task is verified by the suite staying green + browser check.

**Files:**
- Modify: `src/ByomPlayer.ts` (`static styles`)

- [ ] **Step 1: Content-driven stage**

Replace the `.stage` rule:

```css
.stage {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  max-height: 60vh; /* cap: long lists scroll, short lists stay compact */
}
```

The `.tracklist` already has `flex: 1 1 auto; min-height: 0; overflow: auto;` — with a `max-height` cap (not fixed height) on the stage, a short list no longer leaves a void, a long list scrolls, and the 16:9 `.video` still reserves its space and the list flexes into the remainder.

- [ ] **Step 2: Decouple the modal height**

Replace `.settings { height: 60%; overflow: auto; … }` with:

```css
.settings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 22rem;
  min-height: 16rem;
  max-height: min(80%, 32rem);
  overflow: auto;
  background: var(--byom-surface);
  border: 1px solid var(--byom-border);
  border-radius: var(--byom-border-radius);
  padding: 1.25rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 3: Run the suite + build**

Run: `npx vitest run && npm run build`
Expected: PASS + clean.

- [ ] **Step 4: Commit**

```bash
git add src/ByomPlayer.ts
git commit -m "feat(layout): content-driven stage height + decoupled modal height

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Controls & density polish

Tidy the transport controls (consistent ghost/circular treatment, real hit targets, grouped transport) and the tracklist rhythm. CSS-only aside from keeping the shuffle label.

**Files:**
- Modify: `src/ByomPlayer.ts` (`static styles`)

- [ ] **Step 1: Restyle the controls**

Replace the `.controls` / button rules:

```css
.controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.25rem 0;
}
.controls button {
  cursor: pointer;
  font-size: 1.3rem;
  line-height: 1;
  color: var(--byom-text);
  background: transparent;
  border: none;
  border-radius: 999px;
  min-width: 2.4rem;
  min-height: 2.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.controls button:hover {
  background: color-mix(in srgb, var(--byom-text) 10%, transparent);
}
.controls .playpause {
  font-size: 1.7rem;
  color: var(--byom-on-accent);
  background: var(--byom-accent);
}
.controls .playpause:hover {
  background: var(--byom-accent);
  filter: brightness(1.08);
}
```

Keep the existing `.shuffle` / `.shuffle.on` and `.gear` rules but update their color tokens to match (`.shuffle` outline `var(--byom-border)` when off, accent when on; `.shuffle.on { color: var(--byom-on-accent); }`; `.gear` stays `margin-left: auto`).

- [ ] **Step 2: Tracklist density**

The row padding/hover from Task 5 already tightens the rhythm; confirm `.now-playing` reads as a clear now-playing line:

```css
.now-playing {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-height: 1.4rem;
}
.now-playing .np-title { font-weight: 600; }
.now-playing .np-artist { color: var(--byom-text-muted); font-size: 0.9rem; }
```

- [ ] **Step 3: Run the suite + build**

Run: `npx vitest run && npm run build`
Expected: PASS + clean.

- [ ] **Step 4: Commit**

```bash
git add src/ByomPlayer.ts
git commit -m "feat(controls): tidy transport controls + now-playing density

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Skinning-API proof + docs

Prove an external skin can restyle via `::part()` only (no component change), and document the surface.

**Files:**
- Create: `docs/dev-sessions/2026-07-10-1113-visual-design-pass/example-skin.css`
- Modify: `README.md`

- [ ] **Step 1: Write the example skin**

Create `docs/dev-sessions/2026-07-10-1113-visual-design-pass/example-skin.css`:

```css
/* Throwaway proof: restyle <byom-player> using ONLY ::part() + tokens.
   Load in the harness to verify the skin contract; not shipped. */
byom-player {
  --byom-accent: #00e5ff;
  --byom-border-radius: 2px;
}
byom-player::part(controls) {
  justify-content: center;
}
byom-player::part(play) {
  transform: scale(1.1);
}
byom-player::part(track) {
  letter-spacing: 0.02em;
}
```

- [ ] **Step 2: Document the theming surface in README**

Add a "Theming & skins" section to `README.md` documenting: the two-layer model (skin = CSS via `::part()`, theme = tokens), the 9-token table (copy from `spec.md` §B), the parts list (from Task 3), the `theme` attribute + built-in theme names, and the auto light/dark default. Note host inline `--byom-*` overrides win.

- [ ] **Step 3: Verify build + lint (docs are prettier-checked)**

Run: `npm run lint`
Expected: clean (prettier checks `.md`; the `.css` under `docs/` is not in the lint globs — confirm, and if prettier flags it, run `npm run format`).

- [ ] **Step 4: Commit**

```bash
git add docs/dev-sessions/2026-07-10-1113-visual-design-pass/example-skin.css README.md
git commit -m "docs(theme): document the skinning surface + example skin proof

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Browser verification pass

Manual (Playwright-driven) click-through over plain HTTP, since the dev cert can't be accepted.

**Files:**
- Create (temporary): `vite.http.config.ts` — deleted before final commit.

- [ ] **Step 1: Throwaway HTTP vite config**

Create `vite.http.config.ts`:

```ts
import { defineConfig } from 'vite';
export default defineConfig({ server: { host: 'localhost', port: 5174 } });
```

- [ ] **Step 2: Serve + drive**

Run: `npx vite --config vite.http.config.ts` (background). Navigate Playwright to `http://localhost:5174`.

Verify:
- Each theme (Auto, Daylight, Midnight, Terminal, Sunset, Paper, Dracula) renders coherently; Auto follows OS light/dark; host override still wins (load `example-skin.css`).
- Four track states are distinguishable at a glance (active bar, orphan ↯, unavailable ✕ + strike, pending ⋯).
- Short playlist: no empty void. Long playlist: list scrolls, controls stay put.
- Provider switch with a video (YouTube/Spotify) vs. without: layout doesn't jump; idle YouTube box hidden; Spotify embed stays.
- Settings modal comfortable across stage sizes; theme picker persists across reload.

- [ ] **Step 3: Tear down the throwaway config**

Run: `rm vite.http.config.ts`
Confirm it's gone before any further commit; it must not land in git.

- [ ] **Step 4: Capture findings**

Record anything needing live tuning (palette tweaks, spacing) in `notes.md` under "Live-tuning queue" for the interactive pass with Les. Do not commit code changes for subjective tuning yet — those are Les's call.

---

## Self-Review

**Spec coverage:**
- §A parts + `data-state` → Task 3. ✅
- §B 9-token vocabulary → Task 2 (defined) + Task 4 (applied). ✅
- §C theme mechanism (`:host([theme])`, auto light/dark, persist, `settingschange`) → Task 2 + Task 6 (persist via existing `commitSettings`, which already fires `settingschange`). ✅
- §D track-state treatments → Task 5. ✅
- §E stage height, idle embed, modal height → Task 7 (stage/modal) + Task 10 (idle-embed per-provider verification — existing `.video:empty` rule, confirmed, not re-coded). ✅
- §F controls & density → Task 8. ✅
- §G theme picker → Task 6. ✅
- Starter theme set incl. Dracula stretch → Task 2. ✅
- Success criterion "external skin, zero component change" → Task 9 + Task 10. ✅

**Placeholder scan:** No TBD/TODO; every code step shows real code; test steps show real assertions. ✅

**Type consistency:** `theme` property (string) consistent across Tasks 2/6; `trackState` return type consistent with `data-state` usage; `THEMES`/`onDraftTheme` names consistent Task 6; `UserSettings.theme` consistent Tasks 1/2/6. ✅

**Note on TDD granularity:** Pure-CSS tasks (4, 5, 7, 8) have no meaningful happy-dom assertion (no layout/computed-style), so they're gated by the full suite staying green + the Task 10 browser pass rather than a new unit test. This is intentional, not a skipped test.
