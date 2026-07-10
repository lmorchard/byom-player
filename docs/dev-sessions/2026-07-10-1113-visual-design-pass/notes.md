# Notes — Visual/UX design pass

## Outcome

Implemented the full spec + plan on `feat/visual-design-pass`. The structural /
objective layer is done and verified; the subjective layer (exact palette hexes,
spacing) is left staged for a live-tuning pass with Les.

Final gate: **234 tests pass** (was 227; +7 new), `npm run build` clean, `npm run
lint` clean.

## What shipped (10 commits)

1. `feat(settings)` — `theme?: string` on `UserSettings` (round-trips for free).
2. `feat(theme)` — reflected `theme` attribute; apply-persisted-theme on connect;
   9-token vocabulary + `:host([theme])` palette blocks; auto light/dark default
   via `prefers-color-scheme`.
3. `feat(skin)` — `part` surface on every region + `data-state` on track rows
   (kept the existing `.active/.orphan/.unavailable/.pending` classes so behavior
   tests don't regress).
4. `feat(theme)` — Appearance picker at the top of the settings panel (Auto +
   named themes), commits immediately like the provider select.
5. `refactor(theme)` — routed hardcoded colors through the tokens; **decoupled the
   settings-modal height** from the (now variable) stage (min 16rem / max
   min(80%, 32rem), internal scroll).
6. `feat(states)` — marker + color-role per state (active bar+tint, orphan `↯`,
   unavailable `✕`+strike, pending accent `⋯`), no longer opacity-only.
7. `feat(layout)` — stage `height: 60vh` → `max-height: 60vh` (content-driven with
   a cap: short lists compact, long lists scroll, video still reserves 16:9).
8. `feat(controls)` — tidied transport (ghost/circular, real hit targets, filled
   accent play), now-playing density.
9. `docs(theme)` — README "Theming & skins" (token table + parts list + built-in
   themes + skin example) and `example-skin.css` proof.

Starter themes: **Auto** (default), **Daylight**, **Midnight** (the auto
light/dark defaults), **Terminal**, **Sunset**, **Paper**, **Dracula** (stretch).

## Verification (browser, plain-HTTP throwaway config)

Drove the harness over `http://localhost:5174` (throwaway `vite.http.config.ts`,
deleted after — the HTTPS dev cert can't be accepted by Playwright). Confirmed:

- All 6 named themes + Auto render coherently; token vocabulary holds across
  green-phosphor / amber / paper / purple palettes.
- Auto resolved to light (Playwright default OS scheme); Midnight preserves the
  original dark/pink look.
- **Skin proof:** an injected external stylesheet restyled via `::part(controls)`
  (computed `justify-content: center`) and a host `--byom-accent` override won
  (`#00e5ff`) — zero component change. Host inline var override confirmed to win.
- All four track states visually distinct at a glance.
- Settings modal comfortable (min-height gives it presence); Appearance picker
  present and switches live.

## Gotchas / decisions worth remembering

- **Keep the state classes.** Existing behavior tests assert `.orphan` /
  `.unavailable` / `.active` on `.tracklist li`. `data-state` was added
  *alongside* (not replacing) so the skin contract and the tests coexist.
- **`git add -A` swept in `.claude/`** (untracked local tooling incl. an embedded
  worktree) — amended it out. Commit with explicit paths in this repo.
- **`justify-content: center` on `::part(controls)`** has no visible effect while
  `.gear` keeps `margin-left: auto` (the auto margin eats the free space). The
  part is still targetable — the proof stands — but a skin wanting truly centered
  transport would also neutralize the gear's auto margin. Noted for the skin docs
  if we ever ship alternate skins.

## Live-tuning queue (for the interactive pass with Les)

These are subjective calls deliberately NOT finalized — first-draft values are in
place, ready to tune against the live component:

- Palette hexes for all themes (esp. Terminal green intensity, Sunset amber,
  Paper accent, Daylight blue). `--byom-on-accent` per theme.
- Exact `--byom-border-radius` feel, control button sizing/spacing, list row
  padding/rhythm for long playlists.
- State markers: glyph choices (`↯` orphan, `✕` unavailable, `⋯` pending) and
  their color/emphasis — confirm they read right and are distinct enough.
- Active-row treatment: bar thickness + tint strength.
- Stage `max-height` cap (currently 60vh) and modal min/max heights.
- Whether shuffle-on should also switch its border to accent.

## Follow-ups (not this session)

- Alternate *skins* (the Winamp fantasy) remain a documented extension point,
  proven possible but not shipped. Build one only if it shakes out a surface
  wrinkle.
- Per-provider idle-embed check: `.video:empty { display: none }` handles YouTube;
  Spotify's persistent embed stays (correct). Re-verify with live Spotify/YouTube
  when convenient (mock provider has no embed).
