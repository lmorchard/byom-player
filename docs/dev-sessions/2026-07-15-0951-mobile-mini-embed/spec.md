# Spec: Floating mini-embed for narrow players

## Problem

On narrow (mobile) screen sizes, the provider embed region (`.video`) is too
large. Both the YouTube and Spotify embeds mount into a single shared `.video`
element that is locked to `aspect-ratio: 16 / 9` and rendered at full player
width. On a phone that block claims a big slice of the stage, squeezing the
tracklist — which is the part the user most wants to see and scroll.

There are currently **no layout media/container queries**: desktop and mobile
render the identical full-width stacked embed.

## Goal

On narrow players only, shrink the embed to a small floating "preview" pinned to
the lower-right corner, overlapping the tracklist (picture-in-picture style), so
the playlist gets the full stage height. The user can tap the mini preview to
expand it to the full embed and tap again to collapse it. Wide/desktop layout is
unchanged.

## Decisions (from brainstorming)

- **Layout model:** floating overlay in the lower-right corner, on top of the
  tracklist (not inline/reflowed).
- **Interaction:** tap to expand/collapse. Collapsed by default.
- **Trigger:** narrow width only; desktop/wide keeps today's layout.
- **Mini size:** small — targeting ~25%-ish of a typical phone width. Realized
  as a fixed scale factor (see Rendering), not a fluid percentage, so the
  transform math stays pure-CSS.
- **Rendering technique:** CSS `transform: scale()` of a naturally-sized embed
  ("preview"), **not** a natively-tiny iframe box. Chosen because the embed is
  shared across providers and each provider handles small native sizes
  differently (YouTube hides controls; Spotify's 152px card breaks when crushed
  into a 53px 16:9 box). Scaling a known-good render gives a faithful, uniform
  thumbnail regardless of provider.

## Design

### Trigger — container query

`byom-player` is an embeddable web component, so the breakpoint keys off the
*player's own* inline size, not the viewport:

- Add `container-type: inline-size` to `:host`.
- Gate all mini-embed rules behind `@container (max-width: 600px)`.

This behaves correctly whether the player is full-screen or in a narrow column.
Outside the query (wide), everything is exactly as it is today.

### DOM structure

Wrap the existing `.video` in a positioned `.video-wrap` with a sibling toggle
button. The provider mount logic (`querySelector('.video')` +
`replaceChildren`) is **untouched** — it still targets `.video`, so the toggle
button survives track/provider switches.

```html
<div class="video-wrap" part="video-wrap">
  <div class="video" part="video"></div>   <!-- iframe mounts here, as today -->
  <button class="video-toggle" part="video-toggle" aria-expanded=...>…</button>
</div>
```

### State

A single ephemeral boolean on the component, `videoExpanded`, default `false`
(collapsed). It is **not** persisted to settings and resets to collapsed on each
load. In wide mode the state is inert (the toggle is hidden and the embed is
always full-width). No drag, no dismiss-entirely, no per-playlist memory (YAGNI).

### Rendering: transform-scale preview

Natural render size: **320 × 180** (16:9). The inner `.video` always renders the
iframe at this known-good size; a single scale factor drives both the transform
and the wrapper's on-screen footprint, so they always agree with no overflow and
no JS.

A tunable custom property, `--byom-video-scale` (default `0.35`), is the one
knob. At `0.35` the footprint is 112 × 63px — roughly a quarter of a typical
phone width. It's a good candidate for live feel-tuning.

**Collapsed (narrow only):**
- `.video-wrap`: `position: absolute`, pinned to the lower-right of `.stage`;
  `width: calc(320px * var(--byom-video-scale))`;
  `height: calc(180px * var(--byom-video-scale))`; `overflow: hidden`;
  border + shadow + border-radius so it reads as floating above the list.
- `.video` (inner): fixed `width: 320px; height: 180px;`
  `transform: scale(var(--byom-video-scale)); transform-origin: top left;`
  All lengths are multiplications of one factor — no length÷length division, so
  it stays pure CSS.
- `.video-toggle`: transparent, covers the whole mini (`position: absolute;
  inset: 0`), catches taps to **expand**. This also prevents accidental taps on
  the embed's own controls (YouTube fullscreen, Spotify play) while collapsed.
- `.tracklist`: gains `padding-bottom` roughly equal to the mini's height so its
  last rows can scroll clear of the floating preview.

**Expanded (narrow only):**
- `.video-wrap`: back to normal flow, full container width.
- `.video`: `width: 100%`, `transform: none`, `aspect-ratio: 16 / 9` (as today).
- `.video-toggle`: a small button pinned to a corner of the embed to **collapse**
  back to the mini.

**Wide/desktop:** `.video-wrap` full-width in normal flow, `.video` as today,
`.video-toggle` hidden, `videoExpanded` ignored.

### Accessibility

- `.video-toggle` carries `aria-label` ("Expand video" / "Collapse video") that
  tracks the state, plus `aria-expanded={videoExpanded}`.
- Button is keyboard-focusable and toggles on Enter/Space (native `<button>`).

## Implementation notes / open details

- **Scale factor realization (resolved).** One custom property
  `--byom-video-scale` (default `0.35`) drives everything: inner render stays
  fixed at 320×180 and is `transform: scale(var(--byom-video-scale))`; the
  wrapper footprint is `calc(320px * var(--byom-video-scale))` wide by
  `calc(180px * var(--byom-video-scale))` tall. Because every length is a
  *multiplication* by the factor (never a length÷length division, which CSS
  `calc` forbids), no JS is needed. Trade-off vs. a fluid `%` width: the mini is
  a fixed pixel size rather than a live percentage of the container, which is
  simpler and fine across the phone-width range. The factor is a single knob for
  live tuning.
- **Spotify aspect.** Collapsed preview keeps a 16:9 wrapper for a consistent
  corner footprint across providers; Spotify renders its normal card at 320-wide
  natural size before scaling (far better than the current 53px-tall crush).
- **YouTube fidelity caveat.** Scaling YouTube's full player shrinks its control
  bar to a sliver, which can read as cluttered vs. YouTube's own small-size
  layout. This is a pure feel call to be judged live, not from the spec.

## Testing

- Unit test (jsdom): clicking `.video-toggle` flips `videoExpanded` and the
  reflected class/attribute; `aria-expanded` and `aria-label` update.
- Layout/container-query and transform behavior are not testable in jsdom —
  verified live in a browser at narrow and wide widths, for both YouTube and
  Spotify embeds.

## Out of scope

- Dragging or repositioning the mini.
- Dismissing the embed entirely.
- Persisting expand/collapse across loads or per playlist.
- Any change to wide/desktop layout.
