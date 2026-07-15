# Spec: mobile player polish (4 tweaks)

**Branch:** `feat/mobile-player-polish` (off `origin/main` @ v1.0.2)
**Scope:** follow-up tweaks after the floating tap-to-expand mini-embed (#51). All changes live in `src/ByomPlayer.ts`.

## Background

The mini-player work (#49 app-shell layout, #51 floating mini-embed) shipped in v1.0.2. Live testing on `mixtapes.lmorchard.com` surfaced four issues/tweaks. Two are bugs, one is a feature, one is a layout tweak.

## Tweak 1 — Center the expanded embed (bug)

### Problem
When the mini-embed is expanded, `.video` has `aspect-ratio: 16 / 9` + `max-height: 30vh` but no width floor. The box's width is therefore derived from the height cap (`30vh × 16/9`), producing a fixed-width box (~416px at typical viewport heights) that stays **pinned to the left edge** on any player wider than ~460px. Confirmed via live geometry sweep:

| Player width | Stage width | Video width | Left offset |
|---|---|---|---|
| 360–452 | ~fills | ~fills | 0 (looks fine) |
| 481 | 449 | 416 | 0 |
| 751 | 719 | 416 | 0 (302px empty right gutter) |
| 1000 | 968 | 416 | 0 |

At the phone width in the original report (~452px) the box happened to ≈ fill the stage, so the bug only shows on wider players (landscape, tablet, desktop).

### Fix
Add `margin-inline: auto` to `.video` so the height-derived box centers with equal gutters instead of pinning left. Keeps the box size and the 30vh height cap unchanged.

**Verified live:** at 751px this produced 151px gutters on both sides (centered). At narrow widths the box already ≈ fills the stage, so the auto margins collapse to ≈0 — no visible change there.

### Acceptance
- Expanded embed is horizontally centered within `.stage` at all widths where it is narrower than the stage.
- No regression at narrow widths (embed still ≈ fills; mini/collapsed behavior unchanged).

## Tweak 2 — Pause glyph ignores theme color (bug)

### Problem
The play/pause control renders `⏸` (U+23F8) when playing. `⏸` has an **emoji** presentation default, so iOS/macOS render it as the colored (orange) glyph, ignoring the theme's `color`. `▶` (U+25B6) happens to render as a monochrome text glyph, which is why only the pause state looks wrong. The same `⏸`/`▶` pair also appears on the active track row (the row-render glyph in `ByomPlayer.ts`), and `⏮`/`⏭` on prev/next carry the same latent risk.

### Fix
Append the text-presentation variation selector `︎` (VS15) to each affected glyph so it renders as a monochrome text glyph that inherits the theme `color`:
- Transport: `'⏸︎'`, `'▶︎'`, `'⏮︎'`, `'⏭︎'`
- Active track row: the `⏸`/`▶` glyph gets the same treatment.

Chosen over `font-variant-emoji: text` because that CSS property is Safari 17.4+ only; the variation selector is robust across platforms. Shuffle (`🔀`) is out of scope (not reported; has no text variation sequence).

### Acceptance
- With any theme, the pause glyph renders monochrome in the theme's control color (not orange).
- Prev/next/play glyphs remain monochrome and theme-colored.

## Tweak 3 — Collapsible long description, narrow/mobile only (feature)

### Problem
`.description` renders the full playlist annotation. Long descriptions consume significant vertical space above the tracklist, which is scarce on narrow/mobile players.

### Behavior
- **Narrow only:** clamp applies only inside the existing `@container (max-width: 30rem)` block. Wide players always show the full description with no toggle.
- **Collapsed default:** clamp to **3 lines** via `display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden`.
- **Toggle:** a `▾ more` / `▴ less` chevron+text control rendered beneath the description. Uses plain triangles (U+25BE / U+25B4) — monochrome, no emoji-presentation issue.
- **Toggle visibility:** the toggle appears **only when the clamped text actually overflows** (`scrollHeight > clientHeight` while clamped). Short descriptions (≤3 lines) show fully with no toggle.
- **Expanded state:** clicking the toggle sets an ephemeral `@state()` (e.g. `descExpanded`) that removes the clamp; clicking again re-collapses.
- **Reset:** `descExpanded` resets to `false` when the playlist/annotation changes.
- **Resize:** overflow is re-measured on resize (ResizeObserver on the host or description element, rAF-debounced) so rotation / width changes recompute whether the toggle should show, and so crossing the 30rem boundary behaves correctly.

### Acceptance
- On a narrow player with a long description: shows 3 lines + `▾ more`; expands to full text + `▴ less`; re-collapses.
- On a narrow player with a short (≤3-line) description: full text, no toggle.
- On a wide player: full description, no clamp, no toggle, regardless of length.
- Switching playlists resets an expanded description back to collapsed.
- Rotating / resizing across the 30rem boundary updates toggle visibility without a manual reload.

## Tweak 4 — Merge author into the meta line (tweak)

### Problem
The `.meta` column stacks the author (`.creator`, its own `<p>`) above the stats line (`.meta-line`), using two separate type treatments and two lines of vertical space.

### Fix
Fold `pl.creator` into the front of `renderMetaLine`, as the first dot-separated part, with **uniform** styling (same size/color as the rest of the meta line):

```
Les Orchard · 96 tracks · 8 hr 22 min · Dec 2013 – Dec 2022
```

- Remove the standalone `<p class="creator">` element and its now-dead `.creator` CSS rule.
- Preserve the skinning API contract by wrapping the author in `<span part="creator">…</span>` inside the meta line (the `creator` part must still resolve for existing skins). Uniform styling means the span adds no distinct visual treatment; it exists to carry the part.
- Omit the author segment (and its trailing `·`) entirely when `pl.creator` is absent.

### Acceptance
- With a creator: one line, author first, dot-separated from the stats.
- Without a creator: the line starts at the stats (`96 tracks · …`), no leading separator.
- The `creator` CSS part still targets the author text.
- Existing `renderMetaLine` conditional logic (singular/plural tracks, missing duration, missing date range) is preserved.

## Testing

- **`renderMetaLine`** (unit): author present + full stats; author absent; singular vs plural track count; missing total duration; missing date range. Assert dot-joining and absence of a leading separator when the author is missing.
- **Description toggle** (unit/component where practical): overflow → toggle shown; no overflow → no toggle; toggle flips `descExpanded`; playlist change resets to collapsed.
- **Visual verification** (Playwright against the live/dev harness): embed centering at ≥460px widths; pause glyph color across a theme; description clamp + toggle on narrow width.

## Delivery

- One branch (`feat/mobile-player-polish`) in a `.claude/worktrees` worktree off `origin/main`.
- Commits grouped logically: (a) embed centering + pause glyph (bug fixes), (b) collapsible description (feature), (c) meta-line author merge. May split (a) into two if cleaner.
- Run the repo's lint/format/test before opening the PR.

## Out of scope

- Shuffle glyph presentation (not reported; no text variant).
- Any change to the collapsed/floating mini-embed behavior itself.
- Desktop/wide description clamping.
