# Tracklist Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render only the visible window of the tracklist and check track availability only for what the user actually looks at, so playlists with thousands of tracks stay fast.

**Architecture:** Replace the `<ol>` + `.map()` tracklist with a `<lit-virtualizer>` element that windows the DOM. Replace the linear background availability sweep with an `AvailabilityQueue` driven by the virtualizer's visible range plus a lookahead window around the current track. Availability results persist for the session; unseen tracks stay `'unknown'`.

**Tech Stack:** Lit 3, TypeScript, `@lit-labs/virtualizer` (new dep), Vitest + happy-dom (unit), chromium via the dev server (live verification).

## Global Constraints

- Runtime dependencies stay minimal: the only new one is `@lit-labs/virtualizer` (`^2.1.1`). No other runtime deps.
- happy-dom has no layout engine, so `@lit-labs/virtualizer` does not truly window under Vitest and its `rangeChanged` event does not fire. Unit tests MUST assert on component state / pure functions, never on which rows the virtualizer chose to render. Rendered/windowed behavior is verified live in chromium.
- Preserve public behavior: filtering, scroll-to-active centering, the `part="tracklist"` / `part="track"` styling hooks, and the active/unavailable/pending/orphan row states.
- The dev server is self-signed HTTPS on `https://localhost`. For live verification use chromium with `ignoreHTTPSErrors` (firefox rejects the cert).
- Keep changes scoped to the tracklist DOM and the prescan. Do not touch the JSPF contract, the controller's playback/skip logic, or provider internals.
- Run `npm test` and `npm run lint` before each commit; fix warnings.

---

### Task 1: `AvailabilityQueue` (rewrite `availability.ts`)

Introduce a gentle, de-duping, viewport-friendly availability checker. Keep the existing `sweepAvailability` export in place for now (Task 4 removes it) so the build stays green.

**Files:**
- Modify: `src/availability.ts`
- Test: `src/availability.test.ts`

**Interfaces:**
- Consumes: `AudioProvider` (`checkAvailability?`, `isResolutionCached?`), `AvailabilityStatus`, `Track`.
- Produces:
  - `class AvailabilityQueue`
    - `constructor(provider: AudioProvider, tracks: Track[], onResult: (index: number, status: AvailabilityStatus) => void, opts?: { delayMs?: number })`
    - `request(indices: Iterable<number>): number[]` — enqueues indices not already checked/queued; returns the newly-accepted indices; no-op (returns `[]`) if the provider has no `checkAvailability`.
    - `dispose(): void` — stops draining and ignores further requests.

- [ ] **Step 1: Write the failing tests**

Add to `src/availability.test.ts` (keep the existing `sweepAvailability` tests; add a new `describe`):

```ts
import { AvailabilityQueue } from './availability';

// small helper to await the queue draining when delayMs is 0
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('AvailabilityQueue', () => {
  it('checks requested indices and reports each result once', async () => {
    const p = providerWith(async (t) => (t.title === 'b' ? 'unavailable' : 'available'));
    const results: [number, AvailabilityStatus][] = [];
    const q = new AvailabilityQueue(p, tracks, (i, s) => results.push([i, s]), { delayMs: 0 });
    q.request([0, 1, 2]);
    await tick();
    expect(results).toEqual([
      [0, 'available'],
      [1, 'unavailable'],
      [2, 'available'],
    ]);
  });

  it('is a no-op when the provider cannot check', async () => {
    const q = new AvailabilityQueue(providerWith(undefined), tracks, () => {}, { delayMs: 0 });
    expect(q.request([0, 1, 2])).toEqual([]);
  });

  it('de-dupes: an index already checked or queued is not re-accepted', async () => {
    const p = providerWith(async () => 'available');
    const q = new AvailabilityQueue(p, tracks, () => {}, { delayMs: 0 });
    expect(q.request([0, 1])).toEqual([0, 1]);
    expect(q.request([1, 2])).toEqual([2]); // 1 already seen
    await tick();
    expect(q.request([0, 1, 2])).toEqual([]); // all checked
  });

  it('ignores out-of-range indices', async () => {
    const p = providerWith(async () => 'available');
    const q = new AvailabilityQueue(p, tracks, () => {}, { delayMs: 0 });
    expect(q.request([-1, 5, 1])).toEqual([1]);
  });

  it('reports unknown when a check throws', async () => {
    const p = providerWith(async () => {
      throw new Error('boom');
    });
    const results: AvailabilityStatus[] = [];
    const q = new AvailabilityQueue(p, tracks, (_i, s) => results.push(s), { delayMs: 0 });
    q.request([0, 1, 2]);
    await tick();
    expect(results).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('skips the inter-check delay for cached tracks', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const p = providerWith(async () => 'available');
    p.isResolutionCached = () => true;
    const q = new AvailabilityQueue(p, tracks, () => {}, { delayMs: 50 });
    q.request([0, 1, 2]);
    await tick();
    expect(timeoutSpy.mock.calls.filter((c) => c[1] === 50)).toHaveLength(0);
    timeoutSpy.mockRestore();
  });

  it('delays between uncached checks (but not after the last)', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const p = providerWith(async () => 'available');
    const q = new AvailabilityQueue(p, tracks, () => {}, { delayMs: 40 });
    q.request([0, 1, 2]);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 40));
    await new Promise((r) => setTimeout(r, 40));
    expect(timeoutSpy.mock.calls.filter((c) => c[1] === 40)).toHaveLength(tracks.length - 1);
    timeoutSpy.mockRestore();
  });

  it('stops draining after dispose', async () => {
    let calls = 0;
    const q = new AvailabilityQueue(
      providerWith(async () => {
        calls += 1;
        return 'available';
      }),
      tracks,
      () => {},
      { delayMs: 0 },
    );
    q.request([0, 1, 2]);
    q.dispose();
    await tick();
    expect(calls).toBeLessThanOrEqual(1); // at most the in-flight check
    expect(q.request([0, 1, 2])).toEqual([]); // ignores further requests
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- availability`
Expected: FAIL — `AvailabilityQueue` is not exported.

- [ ] **Step 3: Implement `AvailabilityQueue`**

Add to `src/availability.ts` (below the existing `sweepAvailability`):

```ts
export interface AvailabilityQueueOptions {
  // Cooldown (ms) between uncached checks. Cache hits skip it. Default 300.
  delayMs?: number;
}

// AvailabilityQueue checks the availability of requested tracks gently — one at
// a time, with a cooldown between uncached checks — and de-dupes so each index
// is checked at most once for the queue's lifetime. Results therefore persist
// for the session: request() ignores indices already checked or queued. It is a
// no-op for providers that can't check availability.
export class AvailabilityQueue {
  private readonly check?: (t: Track) => Promise<AvailabilityStatus>;
  private readonly isCached?: (t: Track) => boolean;
  private readonly delayMs: number;
  private readonly pending: number[] = []; // FIFO of indices awaiting a check
  private readonly seen = new Set<number>(); // queued-or-done (dedup)
  private draining = false;
  private disposed = false;

  constructor(
    provider: AudioProvider,
    private readonly tracks: Track[],
    private readonly onResult: (index: number, status: AvailabilityStatus) => void,
    opts: AvailabilityQueueOptions = {},
  ) {
    this.check = provider.checkAvailability?.bind(provider);
    this.isCached = provider.isResolutionCached?.bind(provider);
    this.delayMs = opts.delayMs ?? 300;
  }

  request(indices: Iterable<number>): number[] {
    if (!this.check || this.disposed) return [];
    const accepted: number[] = [];
    for (const i of indices) {
      if (i < 0 || i >= this.tracks.length || this.seen.has(i)) continue;
      this.seen.add(i);
      this.pending.push(i);
      accepted.push(i);
    }
    if (accepted.length) void this.drain();
    return accepted;
  }

  dispose(): void {
    this.disposed = true;
    this.pending.length = 0;
  }

  private async drain(): Promise<void> {
    if (this.draining || !this.check) return;
    this.draining = true;
    try {
      while (this.pending.length && !this.disposed) {
        const i = this.pending.shift()!;
        const cached = this.isCached?.(this.tracks[i]) ?? false;
        let status: AvailabilityStatus;
        try {
          status = await this.check(this.tracks[i]);
        } catch {
          status = 'unknown';
        }
        if (this.disposed) return;
        this.onResult(i, status);
        if (this.delayMs > 0 && !cached && this.pending.length) {
          await new Promise((r) => setTimeout(r, this.delayMs));
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- availability`
Expected: PASS (new `AvailabilityQueue` suite + existing `sweepAvailability` suite).

- [ ] **Step 5: Commit**

```bash
git add src/availability.ts src/availability.test.ts
git commit -m "feat(availability): add AvailabilityQueue for on-demand checks"
```

---

### Task 2: Pure tracklist helpers + decouple tests from row DOM

Extract the filter and orphan logic into pure functions, add a `filteredRows` getter, and re-point the tests that currently count/inspect `.tracklist li` at component state / pure functions instead. This lands while the tracklist is still an `<ol>`, so the converted assertions are verified against the working DOM before virtualization changes anything.

**Files:**
- Modify: `src/ByomPlayer.ts`
- Test: `src/ByomPlayer.test.ts`

**Interfaces:**
- Produces (exported from `src/ByomPlayer.ts`):
  - `function matchesFilter(track: Track, query: string): boolean`
  - `function isOrphan(track: Track): boolean`
- Produces (on `ByomPlayer`, private — tests reach them via cast):
  - `get filteredRows(): Array<{ t: Track; i: number }>`
  - existing `trackState(index: number, orphaned: boolean): string`
  - existing `currentIndex: number`

- [ ] **Step 1: Write/convert the failing tests**

In `src/ByomPlayer.test.ts`, add pure-function imports and helpers near the top:

```ts
import { ByomPlayer, matchesFilter, isOrphan } from './ByomPlayer';
import type { Track } from './types';

// Reach private state/helpers for assertions (no public API for these).
const rowsOf = (el: ByomPlayer) =>
  (el as unknown as { filteredRows: Array<{ t: Track; i: number }> }).filteredRows;
const stateOf = (el: ByomPlayer, i: number, orphaned = false) =>
  (el as unknown as { trackState(i: number, o: boolean): string }).trackState(i, orphaned);
const indexOf = (el: ByomPlayer) => (el as unknown as { currentIndex: number }).currentIndex;
const clickRow = (el: ByomPlayer, i: number) =>
  (el as unknown as { onRowClick(i: number): void }).onRowClick(i);
```

Add a pure-function suite:

```ts
describe('matchesFilter', () => {
  const t: Track = { title: 'Black Out Days', artist: 'Phantogram', album: 'Voices' };
  it('matches everything on an empty query', () => {
    expect(matchesFilter(t, '')).toBe(true);
    expect(matchesFilter(t, '   ')).toBe(true);
  });
  it('matches title/artist/album case-insensitively', () => {
    expect(matchesFilter(t, 'phantogram')).toBe(true);
    expect(matchesFilter(t, 'VOICES')).toBe(true);
    expect(matchesFilter(t, 'black out')).toBe(true);
  });
  it('does not match unrelated text', () => {
    expect(matchesFilter(t, 'zzz')).toBe(false);
  });
});

describe('isOrphan', () => {
  it('is true only when spotifyPresent is explicitly false', () => {
    expect(isOrphan({ title: 'a', artist: 'a', syncState: { spotifyPresent: false } })).toBe(true);
    expect(isOrphan({ title: 'a', artist: 'a', syncState: { spotifyPresent: true } })).toBe(false);
    expect(isOrphan({ title: 'a', artist: 'a' })).toBe(false);
  });
});
```

Now convert the existing DOM-coupled tests. Replace the bodies as follows.

`'loads the manifest and renders title + one row per track'`:

```ts
  it('loads the manifest and derives one row per track', async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector('.title')!.textContent).toContain('Test PL');
    expect(rowsOf(el)).toHaveLength(3);
  });
```

`'marks orphaned tracks (spotify_present === false)'`:

```ts
  it('marks orphaned tracks (spotify_present === false)', async () => {
    const { el } = await mount();
    const rows = rowsOf(el);
    expect(isOrphan(rows[1].t)).toBe(true);
    expect(isOrphan(rows[0].t)).toBe(false);
  });
```

`'clicking a track selects and plays it, moving .active'`:

```ts
  it('selecting a track plays it and makes it active', async () => {
    const { el, provider } = await mount();
    clickRow(el, 2);
    await settle(el);
    expect(indexOf(el)).toBe(2);
    expect(stateOf(el, 2)).toBe('active');
    expect(stateOf(el, 0)).not.toBe('active');
    expect(provider.loadedIndex).toContain('C');
  });
```

`'filters the tracklist by title/artist (case-insensitive)'`:

```ts
  it('filters the tracklist by title/artist (case-insensitive)', async () => {
    const { el } = await mount();
    await setFilter(el, 'bb');
    expect(rowsOf(el).map((r) => r.t.title)).toEqual(['B']);
    await setFilter(el, 'BB');
    expect(rowsOf(el).map((r) => r.t.title)).toEqual(['B']);
  });
```

`'filters the tracklist by album (even though album is not shown)'`:

```ts
  it('filters the tracklist by album (even though album is not shown)', async () => {
    const { el } = await mount();
    await setFilter(el, 'greatest');
    expect(rowsOf(el).map((r) => r.t.title)).toEqual(['C']);
  });
```

`'shows all tracks when the query is cleared'`:

```ts
  it('shows all tracks when the query is cleared', async () => {
    const { el } = await mount();
    await setFilter(el, 'zzz');
    expect(rowsOf(el)).toHaveLength(0);
    await setFilter(el, '');
    expect(rowsOf(el)).toHaveLength(3);
  });
```

`'clicking a filtered row plays the correct real track'`:

```ts
  it('selecting a filtered row plays the correct real track', async () => {
    const { el, provider } = await mount();
    await setFilter(el, 'cc');
    const rows = rowsOf(el);
    expect(rows).toHaveLength(1);
    clickRow(el, rows[0].i);
    await settle(el);
    expect(provider.loadedIndex).toContain('C');
    expect(indexOf(el)).toBe(2); // real index of C, not the filtered position
    expect(stateOf(el, rows[0].i)).toBe('active');
  });
```

`'shows a no-matches message when nothing matches'` — drop the `lis` length line, keep the message assertion:

```ts
  it('shows a no-matches message when nothing matches', async () => {
    const { el } = await mount();
    await setFilter(el, 'zzz');
    expect(rowsOf(el)).toHaveLength(0);
    const msg = el.shadowRoot!.querySelector('.no-matches');
    expect(msg).not.toBeNull();
    expect(msg!.textContent).toContain('zzz');
  });
```

`'clear button empties the query and restores all rows'`:

```ts
  it('clear button empties the query and restores all rows', async () => {
    const { el } = await mount();
    await setFilter(el, 'cc');
    expect(rowsOf(el)).toHaveLength(1);
    const clearBtn = el.shadowRoot!.querySelector<HTMLElement>('.filter-clear');
    expect(clearBtn).not.toBeNull();
    clearBtn!.click();
    await el.updateComplete;
    expect(rowsOf(el)).toHaveLength(3);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
    expect(input.value).toBe('');
  });
```

`'Escape clears the query and restores all rows'` (starts at line 230) — replace both `lis(...)` length checks with `rowsOf(...)`:

```ts
    await setFilter(el, 'cc');
    expect(rowsOf(el)).toHaveLength(1);
```
and after the Escape keydown + settle:
```ts
    expect(rowsOf(el)).toHaveLength(3);
```

`'marks tracks unavailable from the background availability sweep'` — assert on state, not row DOM (this holds under both the current sweep and the Task-4 queue: the sweep/seed covers a 3-track list):

```ts
  it('marks tracks unavailable from the background prescan', async () => {
    const provider = new ControllableProvider();
    (provider as AudioProvider).checkAvailability = async (t) =>
      t.title === 'B' ? 'unavailable' : 'available';
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(stateOf(el, 1)).toBe('unavailable');
    expect(stateOf(el, 0)).not.toBe('unavailable');
  });
```

`'re-scans availability when the provider fires onReset (session change)'` — same conversion for its two class checks:

```ts
    // ...unchanged setup through the first settle...
    expect(stateOf(el, 1)).toBe('unavailable');

    sessionChanged = true;
    fireReset();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(stateOf(el, 1)).not.toBe('unavailable');
```

`'shows a pending state for tracks the prescan has not reached yet'` — assert via `trackState` (holds under both models: with the sweep, 1 & 2 are unreached; with the queue, 1 & 2 are in-flight):

```ts
  it('shows a pending state for tracks not yet resolved', async () => {
    const provider = new ControllableProvider();
    (provider as AudioProvider).checkAvailability = (t) =>
      t.title === 'A' ? Promise.resolve('available') : new Promise(() => {});
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(stateOf(el, 0)).not.toBe('pending'); // checked (available)
    expect(stateOf(el, 1)).toBe('pending');
    expect(stateOf(el, 2)).toBe('pending');
  });
```

Finally, delete the now-unused `lis` helper (line 79) if no test references it anymore. (Grep after conversion: `grep -n "lis(" src/ByomPlayer.test.ts` should return nothing.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- ByomPlayer`
Expected: FAIL — `matchesFilter` / `isOrphan` not exported, `filteredRows` undefined.

- [ ] **Step 3: Extract the pure helpers and `filteredRows`**

In `src/ByomPlayer.ts`, add module-level functions above the `@customElement` decorator (near the top, after imports):

```ts
// Case-insensitive substring match against title, artist, and album. An empty
// query matches everything.
export function matchesFilter(track: Track, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    track.title.toLowerCase().includes(q) ||
    track.artist.toLowerCase().includes(q) ||
    (track.album?.toLowerCase().includes(q) ?? false)
  );
}

// A track is "orphaned" when byom-sync recorded it as no longer present in its
// Spotify source.
export function isOrphan(track: Track): boolean {
  return track.syncState?.spotifyPresent === false;
}
```

Replace the private `matchesFilter` method (currently ByomPlayer.ts:461-469) with a `filteredRows` getter:

```ts
  // Derived, filtered view — never mutates pl.tracks or playback indices. Each
  // row carries its real pl.tracks index so selection maps back correctly.
  private get filteredRows(): Array<{ t: Track; i: number }> {
    const pl = this.playlist;
    if (!pl) return [];
    return pl.tracks.map((t, i) => ({ t, i })).filter(({ t }) => matchesFilter(t, this.filterQuery));
  }
```

In `render()`, replace the local `rows` computation (ByomPlayer.ts:580):

```ts
    const rows = this.filteredRows;
```

In `render()`, replace the inline orphan derivation (ByomPlayer.ts:752) to use the helper:

```ts
            const orphaned = isOrphan(t);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- ByomPlayer availability` then `npm run lint`
Expected: PASS; lint clean. (The `<ol>` still renders, so the converted assertions pass against real DOM state.)

- [ ] **Step 5: Commit**

```bash
git add src/ByomPlayer.ts src/ByomPlayer.test.ts
git commit -m "refactor(tracklist): extract pure filter/orphan helpers, add filteredRows"
```

---

### Task 3: Virtualize the tracklist with `@lit-labs/virtualizer`

Swap the `<ol>` for `<lit-virtualizer>`, extract `renderRow`, and switch centering to the virtualizer's `scrollToIndex`. Prescan stays sweep-based for now (Task 4 replaces it). Windowing/centering are verified live (Step 6).

**Files:**
- Modify: `package.json` (dependency), `src/ByomPlayer.ts`

**Interfaces:**
- Consumes: `matchesFilter`/`filteredRows`/`trackState`/`trackClasses` from Task 2.
- Produces (on `ByomPlayer`, private):
  - `renderRow(t: Track, i: number, playing: boolean)` — the per-row template.
  - `onRangeChanged` — a bound event handler (wired now; used by Task 4).

- [ ] **Step 1: Install the dependency**

Run: `npm install @lit-labs/virtualizer@^2.1.1`
Expected: `@lit-labs/virtualizer` appears under `dependencies` in `package.json`; `package-lock.json` updates.

- [ ] **Step 2: Import and register the element**

At the top of `src/ByomPlayer.ts`, after the existing imports:

```ts
import '@lit-labs/virtualizer';
```

- [ ] **Step 3: Extract `renderRow`**

Add this method to `ByomPlayer` (moving the inner markup verbatim from the current `rows.map` body, ByomPlayer.ts:751-789). Add `role="listitem"`:

```ts
  private renderRow(t: Track, i: number, playing: boolean) {
    const orphaned = isOrphan(t);
    const state = this.trackState(i, orphaned);
    // The active row's glyph mirrors playback; any other row offers play.
    const glyph = state === 'active' ? (playing ? '⏸' : '▶') : '▶';
    return html`
      <li
        class=${this.trackClasses(i, orphaned)}
        part="track"
        role="listitem"
        data-state=${state}
        @click=${() => this.onRowClick(i)}
      >
        <span class="num" part="track-number">
          <span class="idx">${state === 'pending' ? '⋯' : i + 1}</span>
          <span class="glyph">${glyph}</span>
        </span>
        <span class="thumb" part="track-art">
          ${
            t.image
              ? html`<img src=${t.image} alt="" loading="lazy" />`
              : html`<span class="thumb-ph" aria-hidden="true">♪</span>`
          }
        </span>
        <span class="cell">
          <span class="t-title">${t.title}</span>
          <span class="t-artist">${t.artist}</span>
        </span>
        <span class="dur"
          >${
            state === 'unavailable'
              ? '✕'
              : t.durationMs
                ? ByomPlayer.formatTime(t.durationMs)
                : ''
          }</span
        >
      </li>
    `;
  }
```

- [ ] **Step 4: Replace the `<ol>` with `<lit-virtualizer>`**

In `render()`, replace the whole `<ol class="tracklist">…</ol>` block (ByomPlayer.ts:750-790) with:

```ts
        <lit-virtualizer
          class="tracklist"
          part="tracklist"
          role="list"
          .items=${rows}
          .keyFunction=${(row: { i: number }) => row.i}
          .renderItem=${(row: { t: Track; i: number }) => this.renderRow(row.t, row.i, playing)}
          @rangeChanged=${this.onRangeChanged}
        ></lit-virtualizer>
```

Add the (currently minimal) range handler — it just records the range for now; Task 4 makes it drive checks:

```ts
  // The virtualizer reports its rendered index range (positions within the
  // filtered rows). Recorded here; Task 4 uses it to drive availability checks.
  private onRangeChanged = (e: Event): void => {
    const { first, last } = e as Event & { first?: number; last?: number };
    if (typeof first !== 'number' || typeof last !== 'number' || first < 0) return;
    this.lastRange = { first, last };
  };
```

Add the field near the other private fields (ByomPlayer.ts:~124):

```ts
  private lastRange: { first: number; last: number } | null = null;
```

- [ ] **Step 5: Switch centering to `scrollToIndex`**

Replace `centerActiveTrack()` (ByomPlayer.ts:419-429) with:

```ts
  // Scroll the virtualized list so the active row is centered. The virtualizer
  // owns scroll position, so we translate the real track index into its position
  // within the filtered rows. No-op if the active track is filtered out, or in
  // environments without layout (tests).
  private centerActiveTrack(): void {
    const pos = this.filteredRows.findIndex((r) => r.i === this.currentIndex);
    if (pos < 0) return;
    const v = this.renderRoot.querySelector('lit-virtualizer') as
      | (HTMLElement & { scrollToIndex?: (index: number, position?: string) => void })
      | null;
    v?.scrollToIndex?.(pos, 'center');
  }
```

- [ ] **Step 6: Update the tracklist CSS for the custom element**

The `.tracklist` selector now targets `<lit-virtualizer>` instead of `<ol>`. Update the rule (ByomPlayer.ts:1232-1239) so the custom element is the scroller:

```css
    .tracklist {
      display: block;
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
```

(The `list-style`/`margin`/`padding` reset is no longer needed — the element is not an `<ol>`. The `.tracklist li` grid rules below stay as-is; `<li>` remain descendants.)

- [ ] **Step 7: Run tests + lint**

Run: `npm test && npm run lint`
Expected: PASS — the Task-2 conversions don't depend on the virtualizer rendering rows, so they still pass under happy-dom. Lint clean.

- [ ] **Step 8: Live verify windowing + centering (chromium)**

Start the dev server: `npm run dev` (serves `https://localhost:5173`, self-signed).
Using chromium with `ignoreHTTPSErrors`, open the harness and load a normal playlist (e.g. "2014 Top Songs (100)"). Confirm:
- The tracklist scrolls within the component (never the host page).
- Playing a track and pressing next/prev keeps the active row centered.
- Typing in the filter narrows the visible rows; clicking a filtered row plays the right track.
- DevTools → Elements: only a window of `<li>` (not all 100) is present under `<lit-virtualizer>` while scrolled.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/ByomPlayer.ts
git commit -m "feat(tracklist): virtualize rows with @lit-labs/virtualizer"
```

---

### Task 4: Viewport-driven prescan (replace the linear sweep)

Wire `rangeChanged` + a playback lookahead into an `AvailabilityQueue`, track in-flight rows in a `checking` set, and remove the old `sweepAvailability` path, `scanning`, and `sweepAbort`.

**Files:**
- Modify: `src/ByomPlayer.ts`, `src/availability.ts`, `src/availability.test.ts`

**Interfaces:**
- Consumes: `AvailabilityQueue` (Task 1); `filteredRows`, `lastRange`, `onRangeChanged` (Task 3).
- Produces (on `ByomPlayer`, private): `checking: Set<number>`, `availQueue: AvailabilityQueue | null`, `armAvailabilityQueue()`, `onAvailabilityResult()`, `enqueueChecks()`, `requestVisible()`, `requestAround()`.

- [ ] **Step 1: Add in-flight state; remove sweep state**

In `ByomPlayer`, remove `@state() private scanning = false;` (ByomPlayer.ts:111) and `private sweepAbort: AbortController | null = null;` (ByomPlayer.ts:123). Add:

```ts
  @state() private checking = new Set<number>();
  private availQueue: AvailabilityQueue | null = null;
```

Update the imports: remove `sweepAvailability`, add `AvailabilityQueue`:

```ts
import { AvailabilityQueue } from './availability';
```

- [ ] **Step 2: Repoint `pending` at the `checking` set**

In `trackClasses` (ByomPlayer.ts:550) and `trackState` (ByomPlayer.ts:566), replace the `pending` computation:

```ts
    const pending = this.checking.has(index);
```

(Delete the old `this.scanning && !this.availability.has(index) && !this.failed.has(index)` expressions in both methods.)

- [ ] **Step 3: Replace the sweep with the queue**

Delete `startSweep()` (ByomPlayer.ts:379-397). Add:

```ts
  // (Re)create the availability queue for the active provider and seed it with
  // the tracks worth checking right now: a lookahead window around the current
  // track plus whatever the virtualizer last reported as visible. Safe to call
  // on init and on a provider/session reset.
  private armAvailabilityQueue(): void {
    this.availQueue?.dispose();
    this.availQueue = null;
    this.checking = new Set();
    const prov = this.activeProvider;
    if (!prov?.checkAvailability || !this.prescan || !this.playlist) return;
    this.availQueue = new AvailabilityQueue(
      prov,
      this.playlist.tracks,
      (i, status) => this.onAvailabilityResult(i, status),
      { delayMs: this.prescanDelayMs },
    );
    this.requestAround(this.currentIndex);
    if (this.lastRange) this.requestVisible(this.lastRange.first, this.lastRange.last);
  }

  private onAvailabilityResult(i: number, status: AvailabilityStatus): void {
    this.availability = new Map(this.availability).set(i, status);
    if (this.checking.has(i)) {
      const next = new Set(this.checking);
      next.delete(i);
      this.checking = next;
    }
    // Let the queue skip known-missing tracks (shuffle + advance).
    if (status === 'unavailable') this.controller?.markUnavailable(i, true);
  }

  // Enqueue real track indices and reflect the newly-accepted ones as in-flight.
  private enqueueChecks(indices: number[]): void {
    const accepted = this.availQueue?.request(indices) ?? [];
    if (!accepted.length) return;
    const next = new Set(this.checking);
    for (const i of accepted) next.add(i);
    this.checking = next;
  }

  // `first`/`last` are positions within the filtered rows; map them to real
  // track indices before enqueuing.
  private requestVisible(first: number, last: number): void {
    const rows = this.filteredRows;
    const idx: number[] = [];
    for (let p = Math.max(0, first); p <= last && p < rows.length; p++) idx.push(rows[p].i);
    this.enqueueChecks(idx);
  }

  // A small forward window from `index` (playback advances forward).
  private requestAround(index: number): void {
    const LOOKAHEAD = 10;
    const idx: number[] = [];
    for (let i = index; i < index + LOOKAHEAD; i++) idx.push(i);
    this.enqueueChecks(idx);
  }
```

- [ ] **Step 4: Make `onRangeChanged` drive checks**

Update the handler from Task 3 to enqueue the visible window:

```ts
  private onRangeChanged = (e: Event): void => {
    const { first, last } = e as Event & { first?: number; last?: number };
    if (typeof first !== 'number' || typeof last !== 'number' || first < 0) return;
    this.lastRange = { first, last };
    this.requestVisible(first, last);
  };
```

- [ ] **Step 5: Rewire the call sites**

In `initProvider()`, replace the final `this.startSweep();` (ByomPlayer.ts:374) with:

```ts
    this.armAvailabilityQueue();
```

In `handleProviderReset()` (ByomPlayer.ts:266-273), replace `this.startSweep();` with:

```ts
    this.armAvailabilityQueue();
```

In `initProvider()`'s reset block (ByomPlayer.ts:309-312) and `loadPlaylist()` (ByomPlayer.ts:285-286), remove the `this.sweepAbort?.abort();` lines (the queue is disposed in `armAvailabilityQueue`; `loadPlaylist` no longer needs to abort a sweep).

In `disconnectedCallback()` (ByomPlayer.ts:257-258), replace:

```ts
    this.availQueue?.dispose();
    this.availQueue = null;
```

On `currentIndex` change, also extend the lookahead. Update `updated()` (ByomPlayer.ts:411-415):

```ts
  updated(changed: PropertyValues): void {
    if (changed.has('currentIndex')) {
      this.centerActiveTrack();
      this.requestAround(this.currentIndex);
    }
  }
```

- [ ] **Step 6: Remove `sweepAvailability` and its tests**

Delete `sweepAvailability` and its `SweepOptions` interface from `src/availability.ts` (leaving only `AvailabilityQueue`). In `src/availability.test.ts`, delete the `describe('sweepAvailability', …)` block and the now-unused `sweepAvailability` import. Keep the `AvailabilityQueue` suite and the shared `providerWith`/`tracks` fixtures.

- [ ] **Step 7: Run tests + lint**

Run: `npm test && npm run lint`
Expected: PASS. The availability tests converted in Task 2 assert via `trackState`/state and hold under the queue model (the 3-track list is fully covered by the lookahead seed). Lint clean, no unused symbols.

- [ ] **Step 8: Live verify viewport-driven marks (chromium)**

With `npm run dev` and a provider that supports availability (e.g. YouTube, if credentials are configured), load a large playlist and confirm:
- On load, only a small burst of availability checks fire (near the top + visible window), not thousands.
- Scrolling down triggers checks for newly-visible rows; scrolling back up does **not** re-check (results persist).
- The `⋯` pending glyph appears only on rows currently being checked.
If no availability-capable provider is configured, note that the queue logic is covered by the Task-1 unit tests and skip the end-to-end mark check.

- [ ] **Step 9: Commit**

```bash
git add src/ByomPlayer.ts src/availability.ts src/availability.test.ts
git commit -m "feat(prescan): drive availability checks from the visible range"
```

---

### Task 5: Large-playlist live verification + session notes

Generate a multi-thousand-track playlist, verify the whole thing holds together at scale in chromium, and record results.

**Files:**
- Create: `public/playlists/huge-8000.jspf.json` (dev fixture)
- Modify: `index.html` (add the fixture to the harness list)
- Create: `docs/dev-sessions/2026-07-11-1053-tracklist-virtualization/notes.md`

- [ ] **Step 1: Generate the fixture**

Run this from the repo root (mock-provider-friendly; no network needed):

```bash
node -e '
const track = (n) => ({
  title: `Track ${n}`,
  creator: `Artist ${n % 200}`,
  album: `Album ${n % 500}`,
  duration: 180 + (n % 120),
  location: [`urn:byom:huge:${n}`],
});
const playlist = {
  playlist: {
    title: "Huge (8000 tracks)",
    creator: "dev harness",
    track: Array.from({ length: 8000 }, (_, i) => track(i + 1)),
  },
};
require("fs").writeFileSync(
  "public/playlists/huge-8000.jspf.json",
  JSON.stringify(playlist),
);
console.log("wrote 8000-track fixture");
'
```

- [ ] **Step 2: Add the fixture to the harness**

In `index.html`, add to the `PLAYLISTS` array (near line 133):

```js
        { title: 'Huge (8000 tracks) — perf', src: 'playlists/huge-8000.jspf.json' },
```

- [ ] **Step 3: Live verify at scale (chromium)**

`npm run dev`, open the harness with the mock provider, select "Huge (8000 tracks)". Confirm:
- Initial render is fast (no multi-second freeze); DevTools Elements shows only a window of `<li>`, not 8000.
- Scrolling through thousands of rows stays smooth.
- Filtering to a handful of matches is responsive; clearing restores the full list.
- Selecting a track deep in the list plays it and centers it.
- Memory/CPU stay bounded while scrolling (no unbounded growth).

- [ ] **Step 4: Record results**

Write `docs/dev-sessions/2026-07-11-1053-tracklist-virtualization/notes.md` with: what was built, the before/after behavior at 8000 tracks, anything surprising (esp. `@lit-labs/virtualizer` happy-dom behavior and the `rangeChanged` payload shape observed live), and any follow-ups (e.g. provider-side resolution batching, referenced in issue #39's "out of scope").

- [ ] **Step 5: Commit**

```bash
git add public/playlists/huge-8000.jspf.json index.html docs/dev-sessions/2026-07-11-1053-tracklist-virtualization/notes.md
git commit -m "test(perf): add 8000-track dev fixture + session notes"
```

---

## Self-Review

**Spec coverage:**
- Virtualize with `<lit-virtualizer>` + `renderItem`/`keyFunction` → Task 3. ✓
- `scrollToIndex` centering with filtered-position mapping → Task 3 Step 5. ✓
- `part`/role semantics preserved → Task 3 Steps 3-4. ✓
- Viewport-driven prescan via `rangeChanged` + playback lookahead → Task 4. ✓
- Single code path, all sizes (lookahead seed makes small lists effectively eager) → Task 4 `armAvailabilityQueue`. ✓
- Results persist for the session (de-dup, never re-check) → Task 1 `AvailabilityQueue`, Task 4 wiring. ✓
- `scanning`/`pending` reframed to in-flight `checking` → Task 4 Steps 1-2. ✓
- Reset/abort on playlist/provider switch → Task 4 Step 5. ✓
- Unit tests: queue logic, row-state, filter, centering-position → Tasks 1, 2. ✓
- Adjust existing DOM-counting tests rather than weaken them → Task 2. ✓
- Live chromium verification of windowing/centering/marks → Tasks 3, 4, 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command has an expected result. ✓

**Type consistency:** `AvailabilityQueue(provider, tracks, onResult, opts)`, `request(): number[]`, `dispose()` consistent across Tasks 1/4. `matchesFilter(track, query)`, `isOrphan(track)`, `filteredRows` consistent across Tasks 2/3/4. `checking: Set<number>`, `lastRange`, `onRangeChanged`, `armAvailabilityQueue` consistent across Tasks 3/4. ✓

**Known risk carried into execution:** the exact `@lit-labs/virtualizer` `rangeChanged` payload and `scrollToIndex` signature are handled structurally (local cast, optional-chained call) so a naming surprise degrades gracefully rather than breaking the build; confirm live in Task 3/4 and record in notes.
