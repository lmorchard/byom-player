# Spec: byom-player as an app shell

## Problem

`<byom-player>` sizes itself to its content, with `.stage` capped at
`max-height: 60vh`. When a host embeds it in a viewport-fitted shell (e.g.
byom-sync's `100dvh` playlist page), this fights the shell:

- The `60vh` cap is measured against the **viewport**, blind to the host's
  surrounding chrome, so a mounted video pushes the player past the viewport and
  the host's `<main>` scrolls, clipping content.
- Forcing the player to fill the shell (host `flex:1`) then leaves **dead space**
  inside the card, because the capped stage can't grow to fill it.
- On mobile the tall content + capped tracklist produces a **nested scroll**
  (page scrolls AND the tracklist scrolls inside its `60vh` box), which fights
  the tracklist virtualizer and the scroll-to-current-track behavior.

byom-sync worked around the fit from the outside via `::part()`, but the layout
is the component's own responsibility. Fixing it there makes every embedder
well-behaved.

## Constraints discovered (load-bearing)

- `.tracklist` (`overflow:auto`) is the scroll container for **two** features:
  the `@lit-labs/virtualizer` (needs a bounded scrollport) and
  `centerActiveTrack()` (reads `.tracklist` `scrollTop`/`scrollHeight`/
  `clientHeight`). Any design that lets the list "flow into the page" breaks both
  on large playlists (real playlists reach 1000+ tracks). **The tracklist must
  stay a bounded internal scroller.**

## Goals

1. When given a **bounded height**, byom-player is an **app shell**: header +
   transport + filter stay fixed; the tracklist fills the remaining height and is
   the single scroll region; a mounted video reserves capped space within.
2. **One scroll region** in shell mode — no page scroll, no nested scroll, no
   dead space. Virtualization and scroll-to-current keep working (tracklist stays
   the bounded scroller).
3. **Responsive head** at narrow container width: cover shrinks ~50%, with
   title + creator + meta beside it, and the description on its own full-width
   row beneath.
4. Layout responds to the **player's own size** (container queries), not the
   viewport — correct for any embedding context.

## Non-goals

- Changing playback, providers, virtualization internals, or the settings panel.
- A flowing full-page tracklist on mobile (rejected — breaks virtualization +
  centering).

## Design

### 1. Fill-the-host app shell

- Wrap the shadow content (head / transport / filter / stage) in a single
  `.root { display:flex; flex-direction:column; min-height:0; height:100%; }`.
  Using an internal wrapper (rather than `:host{display:flex}`) makes the layout
  **immune to a consumer overriding the host's `display`** (byom-sync sets
  `byom-player{display:block}`), which was silently defeating `:host` flex.
- `.stage { flex:1 1 auto; min-height:0; }`; `.tracklist` stays
  `flex:1 1 auto; min-height:0; overflow:auto` (unchanged — preserves the
  scroller). `.video` stays `flex:0 0 auto` with a height cap.
- When `:host` has a **definite height** (consumer gives one), `.root`'s
  `height:100%` resolves and the column distributes → app shell. When `:host`
  height is **auto** (unconstrained), `.root` is content-sized.

### 2. Fill by default; drop the `60vh` stage cap

byom-player becomes a **fill-the-host component by default** — no opt-in
attribute. Hosts give it a height; it fills that height as an app shell. This is
a **breaking change** for embedders that relied on content-sizing, which is
acceptable: the only embedders are byom-sync and one blog post, both under our
control.

- Remove `.stage { max-height: 60vh }`. The stage flexes to fill the host
  height; the tracklist scrolls. No cap means no dead space in tall shells.
- **Every embedding context must supply a height.** byom-sync's playlist shell
  already does (via `flex:1` in the `100dvh` column); the byom-sync `/embed`
  page and byom-player's demo `index.html` get an explicit height
  (e.g. `100dvh` / a fixed px). The blog embed gets a height when convenient.
- Unconstrained (no height given) falls back to content-sized. A very long list
  in an unconstrained embed will be tall — the embedder's responsibility to
  bound it. We do not add a fragile CSS "is my parent bounded?" fallback.

### 3. Responsive head (container query)

- Set `container-type: inline-size` on `.root` (or `:host`) so `@container`
  queries respond to the player's width.
- **Restructure the head DOM**: pull `.description` out of `.meta` so it can be
  its own row. `.head` becomes a grid:
  - Wide: `art` column + `meta`/`description` — current look preserved.
  - Narrow (`@container (max-width: ~28rem)`): cover ~52px, `title/creator/meta`
    beside it, `description` on its own full-width row beneath.
- Gear stays pinned top-right (absolute within `:host`).

### 4. byom-sync shell changes (companion)

- Provide a bounded height on the player on **both** desktop and mobile (via the
  `flex:1` shell column); no attribute needed. Give `body.embed` a height so the
  `/embed` page fills its iframe.
- **Rework mobile** (`max-width:48rem`): today it's a scrolling page
  (`height:auto`). For app-shell-everywhere it becomes a fixed `100dvh` shell
  where the player fills the viewport and its tracklist scrolls. This touches
  #43's hamburger-nav mobile CSS (the nav overlay stays; the shell stops being a
  scrolling page). (Decision 3 below.)
- Remove the interim `::part()` fit rules (PR #44) — superseded by `fit`.

## Decisions (confirmed)

1. **App-shell trigger**: **fill-the-host by default**, no `fit` attribute.
   Breaking change accepted (only byom-sync + one blog post embed, both ours).
2. **Description at wide width**: **keep it beside** the cover at desktop width;
   the grid reflows to a full-width description row only at narrow container
   width.
3. **Mobile shell**: **yes** — rework mobile to a fixed `100dvh` shell (player
   fills the viewport, tracklist scrolls); #43's hamburger nav overlay stays.

## Verification

Headless (Playwright) harness across: desktop 800 / tall 1300 / mobile 390, and
a short (≈3-track) *and* long (96+ track) playlist. Assert per case:

- no page scroll, no `<main>` overflow, no dead space in the card;
- exactly one scroll region (the tracklist);
- virtualizer renders a windowed range and `centerActiveTrack()` centers the
  playing row;
- head restacks below the narrow container breakpoint (cover ~52px, description
  full-width row).

## Rollout

byom-player PR → release (v1.0.1) → byom-sync bumps the `player_src` pin and
lands the shell/`fit` changes. PR #44 (byom-sync `::part` fit) is superseded and
folds into the byom-sync companion change.

## Affected files

- `byom-player`: `src/ByomPlayer.ts` (head DOM restructure; `.root` wrapper;
  `fit` mode; container-query head layout; stage/video CSS).
- `byom-sync`: `internal/site/assets/site.css` (mobile shell rework, remove
  interim `::part` rules), `internal/site/templates/playlist.html` (`fit`),
  `cmd/root.go` (bump `player_src` pin after release).
