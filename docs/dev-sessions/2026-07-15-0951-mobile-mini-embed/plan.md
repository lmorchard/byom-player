# Mobile Floating Mini-Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On narrow players, shrink the provider embed into a tap-to-expand floating "preview" pinned to the lower-right corner so the tracklist gets the full stage.

**Architecture:** Wrap the existing `.video` in a `.video-wrap` with a sibling toggle button; a single ephemeral `videoExpanded` state flips a `.video-expanded` class on `.stage`. All the shrink behavior is CSS inside the existing `@container (max-width: 30rem)` breakpoint: collapsed mode renders the embed at a fixed 320×180 and `transform: scale()`s it down (so YouTube and Spotify both stay faithful), pinned absolutely to the stage; expanded mode returns to today's full-width layout. Wide/desktop is unchanged.

**Tech Stack:** Lit 3 web component (TypeScript), Vitest + jsdom, CSS container queries, `:has()`, `color-mix()`, CSS `transform`.

## Global Constraints

- Provider mount logic queries `this.renderRoot.querySelector('.video')` and calls `replaceChildren()` on it (ByomPlayer.ts:364, :400). The `.video` element and its `class="video" part="video"` MUST remain a single queryable node; the toggle button must be a **sibling**, never a child of `.video`.
- Container is `.root` (`container-type: inline-size`, ByomPlayer.ts:1137). The narrow breakpoint is **`@container (max-width: 30rem)`** — reuse it; do not introduce a new width.
- `videoExpanded` is ephemeral component state only — never persisted to settings, defaults to `false` (collapsed) each load.
- One tunable knob `--byom-video-scale` (default `0.35`) drives both the transform and the wrapper footprint via multiplication only (no length÷length division).
- Wide/desktop layout must not change: outside the container query the toggle is `display: none` and the embed is full-width as today.
- Verify: `npm run test`, `npm run lint`, `npm run build` all pass before finishing.

---

## File Structure

- **Modify** `src/ByomPlayer.ts`
  - Add `@state() private videoExpanded = false;`
  - Add `private toggleVideoExpanded(): void`
  - Template: add `video-expanded` class to `.stage`; wrap `.video` in `.video-wrap` + toggle button (render lines ~973–987).
  - Styles (in the `static styles` block): add `--byom-video-scale` token; `position: relative` on `.stage`; `.video-wrap` / `.video-toggle` base rules; narrow-breakpoint rules.
- **Modify** `src/ByomPlayer.test.ts`
  - Add a `describe` block covering the toggle behavior + a11y attributes.

Two tasks: Task 1 is the behavior (state + handler + DOM + unit test — testable in jsdom). Task 2 is the layout CSS (not unit-testable; verified live in a browser).

---

### Task 1: Toggle state, handler, DOM, and unit test

**Files:**
- Modify: `src/ByomPlayer.ts` (add state near :141–157; handler near :692; template :973–987; one baseline style rule)
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Produces:
  - `videoExpanded: boolean` — private `@state`, default `false`.
  - `toggleVideoExpanded(): void` — flips `videoExpanded`.
  - DOM contract consumed by Task 2's CSS: `.stage` carries class `video-expanded` iff expanded; `.video-wrap > .video` (embed host, unchanged) and `.video-wrap > button.video-toggle` (sibling).

- [ ] **Step 1: Write the failing test**

Add to `src/ByomPlayer.test.ts` (uses the existing `mount()` helper):

```ts
describe('video expand toggle', () => {
  const expandedOf = (el: ByomPlayer) =>
    (el as unknown as { videoExpanded: boolean }).videoExpanded;

  it('toggles videoExpanded and reflects state on the button', async () => {
    const { el } = await mount();
    const stage = () => el.shadowRoot!.querySelector('.stage')!;
    const toggle = () => el.shadowRoot!.querySelector<HTMLButtonElement>('.video-toggle')!;

    // Default collapsed.
    expect(expandedOf(el)).toBe(false);
    expect(stage().classList.contains('video-expanded')).toBe(false);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Expand video');

    // The embed host is a sibling of the toggle, never its child (provider
    // mount targets `.video`).
    const wrap = el.shadowRoot!.querySelector('.video-wrap')!;
    expect(wrap.querySelector(':scope > .video')).not.toBeNull();
    expect(wrap.querySelector(':scope > .video-toggle')).not.toBeNull();
    expect(toggle().querySelector('.video')).toBeNull();

    // Tap to expand.
    toggle().click();
    await el.updateComplete;
    expect(expandedOf(el)).toBe(true);
    expect(stage().classList.contains('video-expanded')).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Collapse video');

    // Tap to collapse.
    toggle().click();
    await el.updateComplete;
    expect(expandedOf(el)).toBe(false);
    expect(stage().classList.contains('video-expanded')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ByomPlayer.test.ts -t "toggles videoExpanded"`
Expected: FAIL — `.video-toggle` doesn't exist yet, so `toggle()` is `null` and `.getAttribute` throws (or the `.video-wrap` query is null).

- [ ] **Step 3: Add the reactive state**

In `src/ByomPlayer.ts`, alongside the other `@state()` declarations (near line 155, next to `private view`):

```ts
  // Collapsed by default; only meaningful on narrow players (CSS gates the
  // floating-mini vs. full-width layout). Ephemeral — never persisted.
  @state() private videoExpanded = false;
```

- [ ] **Step 4: Add the toggle handler**

In `src/ByomPlayer.ts`, next to `toggleShuffle` (near line 692):

```ts
  private toggleVideoExpanded(): void {
    this.videoExpanded = !this.videoExpanded;
  }
```

- [ ] **Step 5: Update the template**

In `render()`, replace the stage block (currently lines ~973–987):

```ts
        <div class="stage" part="stage">
          <div class="tracklist-empty">
            ${rows.length === 0 && q ? html`<p class="no-matches">No tracks match "${q}"</p>` : nothing}
          </div>
          <div class="tracklist" part="tracklist">
            <lit-virtualizer
              role="list"
              .items=${rows}
              .keyFunction=${(row: { i: number }) => row.i}
              .renderItem=${(row: { t: Track; i: number }) => this.renderRow(row.t, row.i, playing)}
              @rangeChanged=${this.onRangeChanged}
            ></lit-virtualizer>
          </div>
          <div class="video" part="video"></div>
        </div>
```

with:

```ts
        <div class="stage ${this.videoExpanded ? 'video-expanded' : ''}" part="stage">
          <div class="tracklist-empty">
            ${rows.length === 0 && q ? html`<p class="no-matches">No tracks match "${q}"</p>` : nothing}
          </div>
          <div class="tracklist" part="tracklist">
            <lit-virtualizer
              role="list"
              .items=${rows}
              .keyFunction=${(row: { i: number }) => row.i}
              .renderItem=${(row: { t: Track; i: number }) => this.renderRow(row.t, row.i, playing)}
              @rangeChanged=${this.onRangeChanged}
            ></lit-virtualizer>
          </div>
          <div class="video-wrap" part="video-wrap">
            <div class="video" part="video"></div>
            <button
              class="video-toggle"
              part="video-toggle"
              type="button"
              @click=${this.toggleVideoExpanded}
              aria-expanded=${this.videoExpanded ? 'true' : 'false'}
              aria-label=${this.videoExpanded ? 'Collapse video' : 'Expand video'}
              title=${this.videoExpanded ? 'Collapse video' : 'Expand video'}
            >
              ${this.videoExpanded ? '×' : '⤢'}
            </button>
          </div>
        </div>
```

(`×` = `×` collapse glyph; `⤢` = `⤢` expand glyph. Write the literal characters in the source — shown here as escapes only to be unambiguous.)

- [ ] **Step 6: Add the baseline style so the button isn't a stray element**

In the `static styles` block, immediately after the `.video iframe { … }` rule (near line 1358), add:

```css
    /* The embed lives inside a positioned wrapper so a corner toggle can anchor
       to it. Wrapper reserves space like the old .video flex child did, and the
       whole region hides when no embed is mounted. */
    .video-wrap {
      position: relative;
      flex: 0 0 auto;
    }
    .video-wrap:has(.video:empty) {
      display: none;
    }
    /* Toggle only appears on narrow players (see the @container block). */
    .video-toggle {
      display: none;
    }
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/ByomPlayer.test.ts -t "toggles videoExpanded"`
Expected: PASS.

- [ ] **Step 8: Run the full test + lint to confirm nothing regressed**

Run: `npm run test && npm run lint`
Expected: all tests pass; eslint + prettier clean. (If prettier flags formatting, run `npm run format` and re-check.)

- [ ] **Step 9: Commit**

```bash
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat: tap-to-expand toggle state + DOM for mobile mini-embed"
```

---

### Task 2: Narrow-mode floating mini-embed CSS

**Files:**
- Modify: `src/ByomPlayer.ts` (`static styles` block only)

**Interfaces:**
- Consumes (from Task 1): `.stage.video-expanded` class contract; `.video-wrap` > `.video` + `.video-toggle` structure; the `.video-wrap` / `.video-toggle` baseline rules.
- Produces: no JS/DOM API — CSS behavior verified live.

- [ ] **Step 1: Add the tunable scale token**

In the `:host { … }` token block (near line 1111, alongside `--byom-border-radius`), add:

```css
      --byom-video-scale: 0.35;
```

- [ ] **Step 2: Make the stage a positioning context**

Modify the `.stage { … }` rule (near line 1332) to add `position: relative;` so the collapsed mini anchors to the stage (not to `:host`, which would place it over the transport):

```css
    .stage {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1 1 auto;
      min-height: 0;
      margin-top: 0.5rem;
      position: relative;
    }
```

- [ ] **Step 3: Add the narrow-breakpoint rules**

Add a new `@container` block immediately after the existing `.video-toggle { display: none; }` baseline rule from Task 1 (keeping the video rules together):

```css
    /* Narrow players: the embed collapses to a small floating "preview" pinned
       to the lower-right of the stage. It's rendered at a full 320x180 and
       scaled down via transform (not a natively-tiny iframe) so YouTube and
       Spotify both stay faithful. Tapping the preview expands it to full width;
       tapping again collapses it. --byom-video-scale is the single size knob. */
    @container (max-width: 30rem) {
      /* --- Collapsed (default): floating mini in the corner --- */
      .stage:not(.video-expanded) .video-wrap {
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 2;
        width: calc(320px * var(--byom-video-scale));
        height: calc(180px * var(--byom-video-scale));
        max-height: none;
        overflow: hidden;
        border: 1px solid var(--byom-border);
        border-radius: calc(var(--byom-border-radius) / 2);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
      }
      .stage:not(.video-expanded) .video {
        width: 320px;
        height: 180px;
        max-height: none;
        aspect-ratio: auto;
        transform: scale(var(--byom-video-scale));
        transform-origin: top left;
      }
      /* Reserve room so the last rows can scroll clear of the floating mini,
         but only when an embed is actually mounted. */
      .stage:not(.video-expanded):has(.video:not(:empty)) .tracklist {
        padding-bottom: calc(180px * var(--byom-video-scale) + 0.75rem);
      }
      /* Transparent full-cover tap target → expand. Also stops accidental taps
         on the embed's own controls while it's tiny. A small scrimmed glyph in
         the corner hints that it's tappable. */
      .stage:not(.video-expanded) .video-toggle {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        padding: 2px 4px;
        font-size: 0.8rem;
        line-height: 1;
        color: var(--byom-text);
        background: transparent;
        border: 0;
        cursor: pointer;
        z-index: 3;
      }
      .stage:not(.video-expanded) .video-toggle::before {
        content: '';
        position: absolute;
        right: 0;
        bottom: 0;
        width: 1.4rem;
        height: 1.4rem;
        background: color-mix(in srgb, var(--byom-bg) 70%, transparent);
        border-top-left-radius: calc(var(--byom-border-radius) / 2);
        z-index: -1;
      }

      /* --- Expanded: full-width embed (today's layout) + a corner collapse
             button. .video-wrap/.video fall back to their base rules; only the
             toggle needs positioning. --- */
      .stage.video-expanded .video-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: 4px;
        right: 4px;
        min-width: 1.6rem;
        min-height: 1.6rem;
        font-size: 1rem;
        line-height: 1;
        color: var(--byom-text);
        background: color-mix(in srgb, var(--byom-bg) 70%, transparent);
        border: 1px solid var(--byom-border);
        border-radius: 999px;
        cursor: pointer;
        z-index: 3;
      }
    }
```

- [ ] **Step 4: Type-check and build**

Run: `npm run build`
Expected: `tsc --noEmit` clean and `vite build` succeeds (CSS is a template string, so this only catches TS errors, but confirms nothing broke).

- [ ] **Step 5: Verify live in a browser (narrow + wide, both providers)**

Run the dev/preview build and load a playlist (see repo README / `vite.pages.config.ts` for the pages harness). Confirm:
- At container width **≤ 30rem**: the embed is a small box pinned lower-right, floating over the tracklist; the tracklist uses the full stage and its last rows scroll clear of the mini.
- Tapping the mini **expands** it to full width; the collapse (`×`) button appears top-right; tapping it returns to the mini.
- The YouTube embed AND the Spotify embed both look faithful when collapsed (this is the transform-scale payoff — eyeball the YouTube control-bar clutter here; adjust `--byom-video-scale` if it reads badly).
- At width **> 30rem**: layout is unchanged from before — full-width embed, no toggle button visible.
- With no track playing / no embed mounted: no empty floating box appears.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: clean. (`npm run format` if prettier flags the CSS string.)

- [ ] **Step 7: Commit**

```bash
git add src/ByomPlayer.ts
git commit -m "feat: floating scaled mini-embed for narrow players"
```

---

## Notes / deviations from spec

- **Breakpoint:** spec proposed 600px; the plan reuses the component's existing `@container (max-width: 30rem)` (480px) narrow breakpoint rather than adding a second one. Flagged for Les.
- **Container element:** `container-type: inline-size` already exists on `.root` (spec assumed it needed adding to `:host`); no change needed there.
- **Expanded position:** on wide/desktop the embed currently sits at the **bottom** of the stage (DOM order: tracklist then video). Expanded narrow matches that — full-width in place — which is consistent, so no reordering.

## Self-Review

**Spec coverage:**
- Floating overlay lower-right → Task 2 collapsed `.video-wrap` (absolute, right/bottom). ✓
- Tap to expand/collapse, collapsed default → Task 1 state/handler/DOM; Task 2 toggle. ✓
- Narrow-only, desktop unchanged → `@container (max-width: 30rem)`; toggle `display:none` + full-width outside. ✓
- Transform-scale of 320×180 via `--byom-video-scale` → Task 2 Step 1 & 3. ✓
- Toggle as `.video`-sibling; provider mount untouched → Task 1 Step 5/6 + test assertion; Global Constraints. ✓
- Tracklist bottom padding → Task 2 Step 3 (`:has(.video:not(:empty))`). ✓
- A11y (`aria-expanded`/`aria-label`) → Task 1 template + test. ✓
- Ephemeral state, not persisted → Global Constraints; `@state` default false. ✓
- Testing (jsdom unit + live layout) → Task 1 unit test; Task 2 Step 5 live checks. ✓
- Out of scope (drag/dismiss/persist) → not implemented. ✓

**Placeholder scan:** none — all steps carry concrete code/commands.

**Type consistency:** `videoExpanded` / `toggleVideoExpanded` / `.video-expanded` / `.video-wrap` / `.video-toggle` used identically across tasks and test.
