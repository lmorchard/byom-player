# Mobile Player Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four follow-up tweaks to the byom-player mini-embed work: center the expanded embed, fix the theme-ignoring pause glyph, add a collapsible description on narrow players, and merge the author into the meta line.

**Architecture:** All changes are in the single Lit component `src/ByomPlayer.ts` (styles + template + a little state/measurement logic). Two are CSS/template one-liners, one is a `renderMetaLine` refactor, one adds ephemeral `@state` + a ResizeObserver-driven overflow measurement.

**Tech Stack:** TypeScript, Lit 3 (custom element, `static styles` CSS, `@state`), Vitest + happy-dom for tests, ESLint + Prettier.

## Global Constraints

- All edits live in `src/ByomPlayer.ts` and `src/ByomPlayer.test.ts`. No new files.
- Tests run under **happy-dom**, which has **no layout engine**: `scrollHeight`/`clientHeight`/`getBoundingClientRect` return 0, and `ResizeObserver` may be absent. Guard layout/observer code with `typeof` checks; do NOT write unit tests that depend on real layout — those behaviors are verified visually via Playwright.
- Preserve the skinning API `part` contract: the `creator` part must still resolve after the meta-line merge.
- Lit `@state` uses `!==` change detection; re-setting a state to the same value does not re-render.
- Commands: `npm test` (vitest run), `npm run lint` (eslint + prettier check), `npm run format` (prettier write), `npm run build` (tsc --noEmit + vite build).
- Container-query breakpoint for "narrow/mobile" is the existing `@container (max-width: 30rem)` block. Do not introduce a new breakpoint.

---

### Task 1: Center the expanded embed (CSS bug fix)

**Files:**
- Modify: `src/ByomPlayer.ts` — the `.video` CSS rule (currently ~`1362`).

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (pure CSS).

CSS-only fix; no unit test (happy-dom has no layout). Verified by geometry measurement in the browser (Task 1 Step 3).

- [ ] **Step 1: Add `margin-inline: auto` to `.video`**

The current rule:

```css
    .video {
      flex: 0 0 auto;
      aspect-ratio: 16 / 9;
      /* Cap so a short shell still leaves room for the tracklist; the 16:9 box
         letterboxes within when capped. */
      max-height: 30vh;
      background: var(--byom-surface);
      border-radius: calc(var(--byom-border-radius) / 2);
      overflow: hidden;
    }
```

Add one declaration so the height-derived box centers instead of pinning left:

```css
    .video {
      flex: 0 0 auto;
      aspect-ratio: 16 / 9;
      /* Cap so a short shell still leaves room for the tracklist; the 16:9 box
         letterboxes within when capped. */
      max-height: 30vh;
      /* The box's width is derived from the 30vh height cap (via aspect-ratio),
         so on players wider than the box it must center rather than pin left. */
      margin-inline: auto;
      background: var(--byom-surface);
      border-radius: calc(var(--byom-border-radius) / 2);
      overflow: hidden;
    }
```

- [ ] **Step 2: Build passes**

Run: `npm run build`
Expected: `tsc --noEmit` and vite build succeed (no type/CSS errors).

- [ ] **Step 3: Verify centering in the browser**

Run the dev harness: `npm run dev`, open the player, start a track, expand the embed, and set the host width to 751px. Confirm the embed is centered (equal left/right gutters) rather than left-pinned. (Reference measurement from brainstorming: 719px stage → 416px video → 151px gutters both sides.) Also confirm narrow widths (~400px) still ≈ fill with no visible change.

- [ ] **Step 4: Commit**

```bash
git add src/ByomPlayer.ts
git commit -m "fix(player): center the expanded embed instead of pinning it left"
```

---

### Task 2: Fix theme-ignoring transport/row glyphs (bug fix)

**Files:**
- Modify: `src/ByomPlayer.ts` — `renderRow` glyph (~`750`), transport buttons (~`877`–`892`).
- Test: `src/ByomPlayer.test.ts`.

**Interfaces:**
- Consumes: existing `playbackState` / `playing` state.
- Produces: rendered button text now carries the text-presentation variation selector `︎` after each media glyph.

**Why:** `⏸` (U+23F8) has an emoji-presentation default; iOS/macOS render it colored, ignoring theme `color`. Appending VS15 (`︎`) forces the monochrome text glyph. `▶`, `⏮`, `⏭` get the same treatment for consistency and to remove the latent risk.

- [ ] **Step 1: Write the failing test**

Add to `src/ByomPlayer.test.ts` (near the other render tests). This drives the play/pause button into the "playing" state and asserts the rendered glyph includes the text-presentation selector:

```ts
  it('renders the pause glyph with a text-presentation selector so it inherits theme color', async () => {
    const { el } = await mount();
    // Force the playing state; the play/pause control should render ⏸ + VS15.
    (el as unknown as { playbackState: string }).playbackState = 'playing';
    el.requestUpdate();
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('.playpause')!;
    expect(btn.textContent).toContain('⏸︎'); // ⏸ + VS15
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run -t "text-presentation selector"`
Expected: FAIL — current text is `⏸` without `︎`.

- [ ] **Step 3: Append VS15 to the transport glyphs**

Current transport block (~877–892):

```ts
        <div class="transport" part="transport">
          <div class="ctl-group" part="controls">
            <button class="prev" part="control prev" @click=${this.prev} aria-label="Previous">
              ⏮
            </button>
            <button
              class="playpause"
              part="control play"
              @click=${this.togglePlay}
              aria-label=${playing ? 'Pause' : 'Play'}
            >
              ${playing ? '⏸' : '▶'}
            </button>
            <button class="next" part="control next" @click=${this.next} aria-label="Next">
              ⏭
            </button>
```

Change the three glyphs to force text presentation (note the `︎` escape inside the template literals):

```ts
        <div class="transport" part="transport">
          <div class="ctl-group" part="controls">
            <button class="prev" part="control prev" @click=${this.prev} aria-label="Previous">
              ${'⏮︎'}
            </button>
            <button
              class="playpause"
              part="control play"
              @click=${this.togglePlay}
              aria-label=${playing ? 'Pause' : 'Play'}
            >
              ${playing ? '⏸︎' : '▶︎'}
            </button>
            <button class="next" part="control next" @click=${this.next} aria-label="Next">
              ${'⏭︎'}
            </button>
```

- [ ] **Step 4: Append VS15 to the active-row glyph**

Current `renderRow` glyph (~750):

```ts
    // The active row's glyph mirrors playback; any other row offers play.
    const glyph = state === 'active' ? (playing ? '⏸' : '▶') : '▶';
```

Change to:

```ts
    // The active row's glyph mirrors playback; any other row offers play.
    // VS15 (︎) forces monochrome text presentation so the glyph inherits
    // the theme color instead of rendering as a colored emoji.
    const glyph = state === 'active' ? (playing ? '⏸︎' : '▶︎') : '▶︎';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run -t "text-presentation selector"`
Expected: PASS.

- [ ] **Step 6: Run the full test file + lint**

Run: `npx vitest run src/ByomPlayer.test.ts && npm run lint`
Expected: all pass. (If prettier rewrites the escapes, run `npm run format` and re-check.)

- [ ] **Step 7: Verify color in the browser**

`npm run dev`, play a track, confirm the pause glyph renders in the theme's control color (not orange) across at least one alternate theme. Confirm prev/next/play remain monochrome.

- [ ] **Step 8: Commit**

```bash
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "fix(player): force text presentation on media glyphs so they follow theme color"
```

---

### Task 3: Merge the author into the meta line (tweak)

**Files:**
- Modify: `src/ByomPlayer.ts` — `renderMetaLine` (~`613`–`621`), the `.creator` template line (~`838`), the `.creator` CSS rule (~`1311`–`1315`).
- Test: `src/ByomPlayer.test.ts` (~`995` meta-line test).

**Interfaces:**
- Consumes: `pl.creator`, `pl.tracks`, `sumDurationMs`, `formatTotalDuration`, `formatDateRange` (already imported/used by `renderMetaLine`).
- Produces: `renderMetaLine(pl)` now returns a `<p class="meta-line">` whose first dot-separated segment is `<span part="creator">{creator}</span>` when `pl.creator` is set, followed by the existing stats. The standalone `.creator` `<p>` is removed.

- [ ] **Step 1: Update the meta-line test to expect the merged author, and add a no-creator case**

Current test (~995):

```ts
  it('renders a meta line with track count, total duration, and date range', async () => {
    const { el } = await mount();
    const meta = el.shadowRoot!.querySelector('.meta-line')!.textContent!;
    expect(meta).toContain('3 tracks');
    expect(meta).toContain('4 min'); // 60+120+60s = 4 min
    expect(meta).toContain('Jul 2026 – Sep 2026'); // date (created) – date_updated
  });
```

Replace it with a version asserting the author is folded in and carries the `creator` part, then add a no-creator test. (The default fixture has `creator: 'Les'`.)

```ts
  it('renders a meta line with author, track count, total duration, and date range', async () => {
    const { el } = await mount();
    const line = el.shadowRoot!.querySelector('.meta-line')!;
    const meta = line.textContent!;
    expect(meta).toContain('Les'); // author folded into the front
    expect(meta).toContain('3 tracks');
    expect(meta).toContain('4 min'); // 60+120+60s = 4 min
    expect(meta).toContain('Jul 2026 – Sep 2026'); // date (created) – date_updated
    // Author precedes the track count, dot-separated.
    expect(meta.indexOf('Les')).toBeLessThan(meta.indexOf('3 tracks'));
    // The skinning API `creator` part still resolves, on a span inside the line.
    const creatorPart = line.querySelector('[part~="creator"]')!;
    expect(creatorPart).toBeTruthy();
    expect(creatorPart.textContent).toContain('Les');
  });

  it('omits the author segment (and its separator) when the playlist has no creator', async () => {
    // mount() takes no args; it reads whatever the per-test `fetch` mock returns
    // (default set in beforeEach). Re-mock fetch to a creator-less manifest first.
    const noCreator = structuredClone(jspf);
    delete (noCreator.playlist as { creator?: string }).creator;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => noCreator,
    } as Response);
    const { el } = await mount();
    const meta = el.shadowRoot!.querySelector('.meta-line')!.textContent!.trim();
    expect(meta).not.toContain('Les');
    expect(meta.startsWith('3 tracks')).toBe(true); // no leading separator
    expect(el.shadowRoot!.querySelector('[part~="creator"]')).toBeNull();
  });
```

> `mount()` (confirmed) signature: `async function mount(): Promise<{ el, provider }>` — no args. It mounts `<byom-player>` and its `connectedCallback` fetches via the mocked `fetch` set in the `beforeEach`. Override the mock in-test (as above) to change the loaded manifest. `structuredClone` and `vi` are available in this suite.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ByomPlayer.test.ts -t "meta line"`
Expected: FAIL — author is not in `.meta-line` yet; `[part~="creator"]` is on the separate `<p>`, not inside the line; the no-creator test may error on the mount override.

- [ ] **Step 3: Fold the author into `renderMetaLine`**

Current (~613–621):

```ts
  // "{n} tracks · {total duration} · {created – updated}", each part conditional.
  private renderMetaLine(pl: Playlist) {
    const parts: string[] = [`${pl.tracks.length} ${pl.tracks.length === 1 ? 'track' : 'tracks'}`];
    const total = sumDurationMs(pl.tracks);
    if (total != null) parts.push(formatTotalDuration(total));
    const date = formatDateRange(pl.dateCreated, pl.dateUpdated);
    if (date) parts.push(date);
    return html`<p class="meta-line" part="meta-line">${parts.join(' · ')}</p>`;
  }
```

Replace with (author as a leading `<span part="creator">`, stats unchanged, dot-joined; separator only when both present):

```ts
  // "{author} · {n} tracks · {total duration} · {created – updated}", each part
  // conditional. The author is a <span part="creator"> so skins can still target
  // it after the merge; its styling is uniform with the rest of the line.
  private renderMetaLine(pl: Playlist) {
    const stats: string[] = [`${pl.tracks.length} ${pl.tracks.length === 1 ? 'track' : 'tracks'}`];
    const total = sumDurationMs(pl.tracks);
    if (total != null) stats.push(formatTotalDuration(total));
    const date = formatDateRange(pl.dateCreated, pl.dateUpdated);
    if (date) stats.push(date);
    const statsText = stats.join(' · ');
    return html`<p class="meta-line" part="meta-line">
      ${pl.creator
        ? html`<span class="author" part="creator">${pl.creator}</span>${statsText ? ' · ' : ''}`
        : nothing}${statsText}
    </p>`;
  }
```

> `nothing` and `html` are already imported in this file (used throughout the template). No new imports.

- [ ] **Step 4: Remove the standalone `.creator` template line**

Current (~838):

```ts
            ${pl.creator ? html`<p class="creator" part="creator">${pl.creator}</p>` : nothing}
            ${this.renderMetaLine(pl)}
```

Change to (delete the `.creator` `<p>`; the author now lives inside the meta line):

```ts
            ${this.renderMetaLine(pl)}
```

- [ ] **Step 5: Remove the now-dead `.creator` CSS rule**

Current (~1311–1315):

```css
    .creator {
      margin: 0.15rem 0 0;
      color: var(--byom-text-muted);
      font-size: 0.9rem;
    }
```

Delete this rule entirely (no element uses `.creator` anymore; the author span inherits `.meta-line`, satisfying the "uniform" requirement). Leave `.meta-line` unchanged.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ByomPlayer.test.ts -t "meta line"`
Expected: PASS (both the merged-author test and the no-creator test).

- [ ] **Step 7: Full test file + lint**

Run: `npx vitest run src/ByomPlayer.test.ts && npm run lint`
Expected: all pass. If the `.description` markdown test or others referenced `.creator`, none should — but confirm the full file is green.

- [ ] **Step 8: Commit**

```bash
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(player): merge playlist author into the meta line"
```

---

### Task 4: Collapsible description on narrow players (feature)

**Files:**
- Modify: `src/ByomPlayer.ts` — add `@state` fields (near ~`158`), `firstUpdated`/`disconnectedCallback`/`updated` lifecycle, a `toggleDescExpanded` method and a `measureDescOverflow` method, the description template block (~`841`–`847`), and CSS (`.description` ~`1322`, the `@container (max-width: 30rem)` block ~`1331`).
- Test: `src/ByomPlayer.test.ts`.

**Interfaces:**
- Consumes: `pl.annotation`, `renderMarkdownInline`, `unsafeHTML` (already used), `PropertyValues` (already imported for `updated`).
- Produces:
  - `@state() private descExpanded = false;` — ephemeral expand/collapse.
  - `@state() private descOverflows = false;` — whether the clamped text overflows (gates toggle visibility).
  - `private toggleDescExpanded(): void` — flips `descExpanded`; re-measures on collapse.
  - `private measureDescOverflow(): void` — sets `descOverflows` from `.description` scroll vs client height while collapsed.
  - `private descResizeObserver?: ResizeObserver;`
  - Template: `.description` wrapped in `<div class="desc-block" part="description-block">` with the description and (when `descOverflows`) a `<button class="desc-toggle">`.

**Test note:** happy-dom reports 0 for layout, so `measureDescOverflow` yields `false` in tests and real overflow/reset are verified via Playwright. Unit tests set `descOverflows` directly to exercise the toggle template + state machine.

- [ ] **Step 1: Write the failing tests (toggle template + state machine)**

Add to `src/ByomPlayer.test.ts`:

```ts
  it('shows a description toggle only when the clamped text overflows', async () => {
    const { el } = await mount();
    // No overflow measured (happy-dom) → no toggle.
    expect(el.shadowRoot!.querySelector('.desc-toggle')).toBeNull();
    // Simulate an overflowing clamped description.
    (el as unknown as { descOverflows: boolean }).descOverflows = true;
    el.requestUpdate();
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('.desc-toggle')!;
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toContain('more');
  });

  it('expands and collapses the description via the toggle', async () => {
    const { el } = await mount();
    (el as unknown as { descOverflows: boolean }).descOverflows = true;
    el.requestUpdate();
    await el.updateComplete;
    const desc = el.shadowRoot!.querySelector('.description')!;
    expect(desc.classList.contains('is-collapsed')).toBe(true);
    (el.shadowRoot!.querySelector('.desc-toggle') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(desc.classList.contains('is-collapsed')).toBe(false);
    expect(el.shadowRoot!.querySelector('.desc-toggle')!.textContent).toContain('less');
    (el.shadowRoot!.querySelector('.desc-toggle') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(desc.classList.contains('is-collapsed')).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ByomPlayer.test.ts -t "description"`
Expected: FAIL — no `.desc-toggle`, no `is-collapsed` class, no `descOverflows` state yet.

- [ ] **Step 3: Add the state fields**

Near the other `@state` declarations (after `videoExpanded` ~`158`):

```ts
  // Narrow-player description collapse. Both ephemeral — never persisted.
  @state() private descExpanded = false;
  @state() private descOverflows = false;
```

Add the observer field alongside the other private instance fields (e.g. near `commitTimer`):

```ts
  private descResizeObserver?: ResizeObserver;
```

- [ ] **Step 4: Add the toggle + measurement methods**

Add near `toggleVideoExpanded` (~`699`):

```ts
  private toggleDescExpanded(): void {
    this.descExpanded = !this.descExpanded;
    // On collapse, the clamp is reapplied — re-measure once it settles so the
    // toggle disappears if the text no longer overflows at this width.
    if (!this.descExpanded) {
      void this.updateComplete.then(() => this.measureDescOverflow());
    }
  }

  // Whether the collapsed (line-clamped) description overflows its 3-line box.
  // Only meaningful while collapsed: an expanded description has no clamp, so we
  // leave the last value in place to keep the "less" toggle available.
  // happy-dom (tests) has no layout engine → heights are 0 → stays false.
  private measureDescOverflow(): void {
    if (this.descExpanded) return;
    const desc = this.renderRoot.querySelector('.description') as HTMLElement | null;
    this.descOverflows = desc ? desc.scrollHeight > desc.clientHeight + 1 : false;
  }
```

> Match the file's existing shadow-DOM query convention. If other methods use `this.shadowRoot` rather than `this.renderRoot`, use the same accessor here.

- [ ] **Step 5: Wire the lifecycle (observer setup/teardown + playlist reset)**

Add a `firstUpdated` (the component has no existing one; place it near `updated` ~`517`):

```ts
  firstUpdated(): void {
    // Re-evaluate description overflow when the player's width changes (rotation,
    // resize, crossing the 30rem breakpoint). Guarded: happy-dom lacks
    // ResizeObserver.
    if (typeof ResizeObserver !== 'undefined') {
      this.descResizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => this.measureDescOverflow());
      });
      this.descResizeObserver.observe(this);
    }
  }
```

In `updated(changed)` (~`517`), add a branch so a playlist/annotation change resets the expansion and re-measures:

```ts
  updated(changed: PropertyValues): void {
    if (changed.has('currentIndex')) {
      this.centerActiveTrack();
      this.syncAvailabilityChecks();
    }
    if (changed.has('playlist')) {
      // New annotation: collapse and re-measure once the new DOM settles.
      this.descExpanded = false;
      void this.updateComplete.then(() => this.measureDescOverflow());
    }
  }
```

In `disconnectedCallback` (~`303`), add teardown:

```ts
    this.descResizeObserver?.disconnect();
    this.descResizeObserver = undefined;
```

- [ ] **Step 6: Update the description template**

Current (~841–847):

```ts
          ${
            pl.annotation
              ? html`<div class="description" part="description">
                  ${unsafeHTML(renderMarkdownInline(pl.annotation))}
                </div>`
              : nothing
          }
```

Replace with a `.desc-block` wrapper holding the (conditionally clamped) description and the overflow-gated toggle:

```ts
          ${
            pl.annotation
              ? html`<div class="desc-block" part="description-block">
                  <div
                    class="description ${this.descExpanded ? '' : 'is-collapsed'}"
                    part="description"
                  >
                    ${unsafeHTML(renderMarkdownInline(pl.annotation))}
                  </div>
                  ${this.descOverflows
                    ? html`<button
                        class="desc-toggle"
                        part="control description-toggle"
                        @click=${this.toggleDescExpanded}
                        aria-expanded=${this.descExpanded ? 'true' : 'false'}
                      >
                        ${this.descExpanded ? '▴ less' : '▾ more'}
                      </button>`
                    : nothing}
                </div>`
              : nothing
          }
```

- [ ] **Step 7: Update the CSS**

Move `grid-area`/margin from `.description` to the new `.desc-block`, and add the narrow-only clamp + toggle styling. Current `.description` (~1322):

```css
    .description {
      grid-area: desc;
      margin: 0.35rem 0 0;
      color: var(--byom-text-muted);
      font-size: 0.82rem;
      line-height: 1.4;
    }
```

Replace with:

```css
    .desc-block {
      grid-area: desc;
      margin: 0.35rem 0 0;
    }
    .description {
      color: var(--byom-text-muted);
      font-size: 0.82rem;
      line-height: 1.4;
    }
    /* Toggle is hidden by default (wide players never clamp). */
    .desc-toggle {
      display: none;
    }
```

Then, inside the existing `@container (max-width: 30rem)` block (~1331–1342, currently only `.head` and `.art`), add the clamp and the toggle affordance:

```css
    @container (max-width: 30rem) {
      .head {
        grid-template-areas:
          'art meta gear'
          'desc desc desc';
      }
      .art {
        width: 52px;
        height: 52px;
        font-size: 1.4rem;
      }
      /* Collapse long descriptions to 3 lines on narrow players. */
      .description.is-collapsed {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .desc-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        margin-top: 0.15rem;
        padding: 0;
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--byom-accent);
        font: inherit;
        font-size: 0.78rem;
      }
    }
```

> Keep the `.head`/`.art` rules exactly as they already are; only add the `.description.is-collapsed` and `.desc-toggle` rules inside the block.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/ByomPlayer.test.ts -t "description"`
Expected: PASS (toggle visibility + expand/collapse). The existing "renders the playlist annotation as inline markdown" test still passes (`.description` still exists inside `.desc-block`).

- [ ] **Step 9: Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: all green. Run `npm run format` if prettier flags formatting, then re-run lint.

- [ ] **Step 10: Verify behavior in the browser (the layout-dependent parts)**

`npm run dev`. At a narrow width (<480px container):
- Long description (e.g. the City Club playlist): shows 3 lines + `▾ more`; click expands to full text + `▴ less`; click re-collapses.
- Short description: full text, no toggle.
Switch playlists while expanded → resets to collapsed. Widen past 30rem → full description, no toggle. Narrow again → toggle behavior returns.

- [ ] **Step 11: Commit**

```bash
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "feat(player): collapsible description with show-more on narrow players"
```

---

### Task 5: Final verification & PR prep

**Files:** none (verification only).

- [ ] **Step 1: Full green run**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 2: Cross-tweak visual smoke test**

`npm run dev`. In one session confirm all four: centered expanded embed at ~751px; monochrome themed pause glyph; collapsible description on narrow; single merged author+stats meta line.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/mobile-player-polish
gh pr create --title "Mobile player polish: center embed, glyph color, collapsible description, merged meta line" --body "<summary of the four tweaks + verification notes>"
```

Do not merge without Les's review.

---

## Self-Review

**Spec coverage:**
- Tweak 1 (center embed) → Task 1. ✓
- Tweak 2 (pause glyph color; row + prev/next) → Task 2 (transport + row glyphs). ✓
- Tweak 3 (collapsible description, narrow-only, 3 lines, chevron+text, overflow-gated, reset on playlist change, resize re-measure) → Task 4. ✓
- Tweak 4 (merge author into meta line, uniform, keep `creator` part, omit when absent) → Task 3. ✓
- Testing section (renderMetaLine cases, description toggle state, visual verification) → Tasks 3, 4, 5. ✓
- Delivery (one branch, grouped commits, lint/test before PR) → per-task commits + Task 5. ✓

**Placeholder scan:** PR body in Task 5 Step 3 is intentionally a fill-in at author time (summary of already-specified work); all code steps contain complete code. No TBD/TODO in implementation steps.

**Type consistency:** `descExpanded`/`descOverflows`/`descResizeObserver`/`toggleDescExpanded`/`measureDescOverflow` are named identically across the state declarations, methods, lifecycle, and template. Glyph escapes (`⏸︎` etc.) match between test and implementation. `renderMetaLine` returns a single `<p class="meta-line">` in both the description and the test expectations.

**Test-harness facts (confirmed against `ByomPlayer.test.ts`):** `mount()` takes no args and loads whatever the per-test `fetch` mock (set in `beforeEach`) returns; the no-creator test re-mocks `fetch` before mounting. Private `@state`/methods are reached in tests via `(el as unknown as {...})` casts (existing convention, e.g. `rowsOf`). `PropertyValues` is already imported for `updated`; `html`/`nothing`/`unsafeHTML`/`renderMarkdownInline` are already imported.
