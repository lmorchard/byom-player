# Spec — Visual/UX design pass (`byom-player`)

GitHub issue: #1 ("Phase 5: visual design pass"). Feel-driven, interactive: the
structural surface and semantics are locked here; the subjective layer (exact
colors, spacing, glyphs) is tuned live against the real component during
execution.

## Goal

Turn the functional-but-plain `<byom-player>` into a themed, skinnable component
without regressing behavior. Establish a **skinning API** so the component can be
restyled — up to Winamp-flavored re-skinning — through CSS alone, and ship one
polished default skin with a handful of color themes.

## Core model

Two layers over one clean DOM:

- **Skin** = a stylesheet targeting the component's `::part()`s and CSS
  variables. Controls layout, chrome, shape, density. An alternate skin needs
  **zero** component changes. MVP ships **one** default skin; further skins are a
  documented extension point, built only if doing so shakes out a wrinkle in the
  surface.
- **Theme** = a set of palette values (the `--byom-*` variables) applied *within*
  a skin. Colors, font, radius.

Themes nest inside skins; the clean DOM + complete styling surface is the shared
foundation for both.

## Scope (this session)

1. Refactor the DOM into a clean, fully-`part`'d, fully-variable'd skinning
   surface (designed as the skin API).
2. Ship one polished default skin; resolve the structural knobs as part of it.
3. Expand the theme layer: a 9-token palette vocabulary + auto light/dark, with a
   theme picker in the settings panel.
4. Alternate *skins* deferred — made *possible* now, not delivered.

Non-goals: bitmap chrome, slot/template-based structural skin swapping (couples
skins to internals — the maintenance trap we're explicitly avoiding), multiple
shipped skins.

## Design

### A. DOM & `part` surface (the contract)

Keep the current semantic structure; add a `part` attribute to every region a
skin might target so an external skin is pure CSS against a stable contract:

`header`, `title`, `creator`, `playlist`, `now-playing`, `progress`, `seek`,
`controls`, `control` (+ specific `prev` / `play` / `next` / `shuffle` / `gear`),
`stage`, `tracklist`, `track`, `video` (already present), `settings`.

- Track state is exposed as `data-state="active|orphan|unavailable|pending"` on
  the `track` part, so a skin can write `::part(track)[data-state="unavailable"]`.
  (Chosen over distinct part names per state.)
- CSS variables pierce the shadow boundary for free; `::part()` is the piercing
  mechanism for everything structural.

### B. CSS-variable vocabulary (theme tokens)

Grow from 5 to 9 tokens. Deliberately lean — every var is permanent API. Start
here and add a token only when a shipped theme demonstrably needs one.

| Token | Role |
|---|---|
| `--byom-bg` | base background *(exists)* |
| `--byom-surface` | elevated surfaces: settings card, embed frame |
| `--byom-text` | primary text *(exists)* |
| `--byom-text-muted` | secondary text, timestamps, dimmed states |
| `--byom-accent` | accent / active / fills *(exists)* |
| `--byom-on-accent` | text/glyph on an accent fill |
| `--byom-border` | hairlines, control outlines |
| `--byom-font` | font stack *(exists)* |
| `--byom-border-radius` | corner rounding *(exists)* |

Track-state colors reuse these (muted + treatment) rather than adding a color per
state, keeping the palette a skin must define small. Existing host overrides
(`--byom-accent`, etc.) keep working unchanged.

### C. Theme mechanism

- Built-in themes are `:host([theme="name"])` blocks in `static styles`, each
  setting the token values.
- Default (no `theme` attribute) = a light/dark pair chosen by
  `prefers-color-scheme`.
- Selecting a named theme sets the `theme` attribute, persists to settings
  (alongside `provider` / `debug`), and fires the existing `settingschange`
  event.
- A host setting a token inline still wins over everything.

### D. Track-state treatments (beyond opacity)

Today all four states lean on opacity and blur together. Each state gets a
distinct, glanceable treatment pairing a **marker** with a **color role** (so it
survives low contrast / colorblindness, not just "dimmer"):

- **active** — accent left-border/bar + emphasis; the clear focal row.
- **orphaned** (Spotify-removed) — muted text + a small "detached" badge/glyph;
  reads as "was here, source dropped it," distinct from unavailable.
- **unavailable** (not resolvable) — strikethrough + muted + a subtle ✕
  affordance.
- **pending** (not yet prescanned) — the transient `⋯` marker, gentle; clears as
  the sweep reaches it.

Which signal distinguishes what is locked here; exact glyphs/colors/spacing are
tuned live.

### E. Structural knobs

- **Stage height** — drop the hard `60vh`.
  - List-only: stage sizes to content up to a `max-height` ceiling, then the
    tracklist scrolls (no void for short playlists, no runaway for long ones).
  - Video present: the embed reserves its 16:9 and the tracklist flexes into the
    remaining capped space — preserving the "doesn't jump when switching
    providers" behavior.
- **Idle embed** — `.video:empty { display: none }` already hides YouTube when
  nothing is mounted; Spotify's persistent embed *should* stay (it is the
  player). Verify per-provider that no one mounts an empty-but-present node,
  rather than add a blanket hide.
- **Settings modal height** — decouple from the (now variable) stage. Currently
  `height: 60%`, implicitly anchored to the fixed 60vh stage. Replace with a
  `min-height` + comfortable padding and a `max-height` with internal scroll, so
  the modal is stable and readable regardless of stage height behind it. Tune
  min/max live.

### F. Controls & density

- Keep emoji glyphs for MVP (zero-dependency, theme via font/color), but tidy:
  consistent ghost/circular treatment, real hit targets, transport
  (prev/play/next) grouped, shuffle + gear as secondary, gear pinned right.
- Tracklist gains a tighter, consistent row rhythm for long-list density.
- Arrangement locked here; spacing/size tuned live.

### G. Theme picker

An **Appearance** control at the top of the settings panel — a swatch/select row
of named themes plus **Auto** (follows OS). Persists + sets `theme`. Small; lives
with the other settings.

## Starter theme set (palettes tuned live)

**Auto** (default) resolves by OS to the light/dark default. Named themes:

| Theme | Mode | Feel / rough palette |
|---|---|---|
| **Midnight** | dark *(dark default)* | Current look preserved — near-black bg, white text, `#ff0055` pink accent |
| **Daylight** | light *(light default)* | Off-white bg, near-black text, confident blue/indigo accent |
| **Terminal** | dark | Black / deep-green bg, phosphor-green accent (a wink at the Winamp lineage) |
| **Sunset** | dark | Warm charcoal bg, amber/orange accent |
| **Paper** | light | Warm paper bg, ink text, muted teal/crimson accent |
| **Dracula** *(stretch)* | dark | The well-known palette — bg `#282a36`, text `#f8f8f2`, muted `#6272a4`, purple/pink accent (`#bd93f9`/`#ff79c6`). Added if time allows; its hexes are already specified, so low-risk. |

Auto + 5 named (Midnight & Daylight double as the auto light/dark defaults), plus
**Dracula** as a stretch sixth if time allows. Hex values are starting points. If
a palette *needs* a token the vocabulary lacks, that is the wrinkle telling us to
add one.

## Constraints

- **Behavior tests must keep passing** — do not regress the Phase-3 behavior
  suite while restyling. `npx vitest run` stays green.
- **happy-dom gotchas** (project memory): wrap a bare `${expr}` child in a
  container element; no global `localStorage` in tests (`src/test-setup.ts`
  installs one).
- Lint/format clean (`npm run lint`), build clean (`npm run build`).
- Host inline `--byom-*` overrides must keep working.

## Verification

- Unit/behavior tests green (`npx vitest run`).
- Browser click-through of each theme (incl. Auto light/dark) and every track
  state. Dev server is HTTPS with a self-signed cert Playwright can't accept; for
  browser-driven checks, spin up a throwaway plain-HTTP vite config on another
  port (e.g. `vite.http.config.ts` → port 5174) and delete it before committing.
- Structural: short playlist (no void), long playlist (scrolls), provider switch
  with/without video (no jump), idle embed handling per provider, settings modal
  height across stage sizes.

## Success criteria

- An external skin can restyle the component via `::part()` + variables with no
  component changes (provable with one throwaway demo skin).
- All 5 named themes + Auto render coherently in light and dark; host overrides
  still win.
- The four track states are distinguishable at a glance, not by opacity alone.
- Short playlists are compact; long ones scroll; provider switches don't jump the
  layout.
- Behavior tests, lint, and build all green.
