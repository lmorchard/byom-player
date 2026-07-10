# In-component settings panel

**Session:** 2026-07-09-1745-settings-panel
**Related:** GitHub issue #1 (Phase 5 visual pass — *follow-up session*, not this one)

## Summary

Today `<byom-player>` is purely host-driven: the host page sets a `providerConfig`
JS property and the component never configures itself. The standalone dev harness
(`index.html`) fakes the "user picks a provider and enters credentials" experience.

This session makes that a real, component-native experience: an in-component
**settings panel**, reachable from the player, through which a user selects a
provider, enters their own credentials, and manages auth — with the component
owning and persisting those settings. The player becomes self-configuring.

The **visual/skins pass is explicitly out of scope** (that's the follow-up session
for issue #1). This session stops at a functional, tested panel wearing the
current plain styling. We lock structure first, then tune feel later.

## Goals

- A user can open a settings panel from within the player and choose a provider,
  enter credentials, and connect/disconnect auth — without touching host JS.
- The component owns and persists user settings (localStorage); the host supplies
  only deployment-level config.
- All host-side config is settable via **HTML attributes** (deployment target is a
  static site generator — authors write HTML, not JS).
- Runtime reconfiguration works without remounting the element.
- All existing Phase-3 behavior tests still pass.

## Non-goals

- Visual design, theming, skins, color themes, density tuning (→ issue #1 session).
- User-supplied arbitrary playlist URLs (playlists are host-declared).
- Changing provider auth *flows* (OAuth/PIN logic stays as-is; only where the
  buttons render changes).

## Key decisions

| Decision | Choice |
| --- | --- |
| Session scope | Settings panel (architectural) first; visual pass later. |
| Config ownership | Component owns nearly all; persists to its own localStorage. |
| Host-side config | Deployment defaults only (secrets/keys), **attribute-first**. |
| Provider choice | All available by default; host can restrict set + set default; user picks. |
| Playlist source | Host-declared only. Single `src`, or multiple via child elements. |
| Playlist picker | **Top-level player chrome**, not in the settings panel. |
| Panel gating | On by default; host can hide with `no-settings`. |
| Panel presentation | **Inline view swap** — settings replaces the tracklist region. |
| Auth integration | **Panel auth slot** — providers render their existing buttons into a panel-owned element (`attachAuth`). |
| Dev→user features | Refresh availability, debug toggle, connect/disconnect all become panel features. |

## Config model

Two cleanly separated layers.

### Deployment config (host-supplied, not user-editable)

The deployer's secrets/keys. **Attribute-first**, since the target is a static
site generator. Dedicated string attributes:

- `spotify-client-id` — built-in default exists; host can override.
- `youtube-api-key` — usually omitted; for private installs.
- `youtube-search-endpoint` — server-side search proxy URL.

The existing `providerConfig` object property remains as a **programmatic escape
hatch** for JS hosts. Attributes take precedence for the SSG path.

### User settings (panel-edited, component-persisted)

Persisted to a single namespaced localStorage key `byom-player:settings:v1`:

- Selected provider.
- Per-provider credentials/URLs:
  - subsonic: `baseUrl`, `username`, `password`, `apiKey`
  - plex: `baseUrl`, `token`
  - jellyfin: `baseUrl`, `username`, `password`, `token`, `userId`
- `debug` toggle.

OAuth/session tokens are **not** stored here — Spotify and Plex already persist
their own tokens via their auth clients. Settings storage holds only
user-entered credentials + the provider selection + the debug flag.

### Effective config

`createProvider(name, config)` receives, for the active provider:

```
effective = { ...deploymentConfig[name], ...userSettings[name] }
```

The two key-sets are essentially disjoint per provider, so there is no contention
over the same field. User settings layer on top of deployment defaults, so a host
that seeds e.g. subsonic creds via `providerConfig` just provides defaults until
the user edits them.

`debug` is a **global** flag (not part of the per-provider merge); it is applied
alongside the effective provider config as today (`{ ...effective, debug }`),
seeded by the `debug` attribute and overridable by the in-panel toggle.

### Security posture

User-entered credentials (including passwords) persist in **origin-scoped
localStorage in plaintext** — the same posture the dev harness already has today,
so this is not a regression. Documented in the README. `no-settings` deployments
(fixed or credential-free providers) avoid it entirely.

## Component API changes

### Attributes (host-side, SSG-authorable)

| Attribute | Type | Notes |
| --- | --- | --- |
| `src` | string | Single playlist (existing). |
| `provider` | string | Initial/default selection (existing). Persisted user selection wins once set. |
| `providers` | string (CSV) | Allowlist of selectable providers. Defaults to all built-ins. |
| `no-settings` | boolean | Hides the settings gear. Panel on by default. |
| `prescan` | boolean | Existing. |
| `skip-delay-ms` | number | Existing. |
| `debug` | boolean | Existing; also user-toggleable in-panel. |
| `spotify-client-id` | string | Deployment default. |
| `youtube-api-key` | string | Deployment default. |
| `youtube-search-endpoint` | string | Deployment default. |

### Properties (programmatic hosts)

- `providerConfig` (object) — deployment-config escape hatch; attributes take
  precedence.
- `providerFactory` — existing test/override hook.

### Multiple playlists (child elements)

Authored as light-DOM children, read by the player on connect (invisible, since
the component renders in shadow DOM):

```html
<byom-player provider="youtube" providers="youtube,subsonic">
  <byom-playlist title="Road Trip" src="/road-trip.jspf.json"></byom-playlist>
  <byom-playlist title="Chill Evening" src="/chill.jspf.json"></byom-playlist>
</byom-player>
```

- `<byom-playlist>` need not be a registered custom element — the player reads
  `title` + `src` from `this.querySelectorAll('byom-playlist')` on connect.
- If one or more `<byom-playlist>` children exist, a **top-level** playlist picker
  renders in the player chrome (near the header) and the first is the initial
  selection; otherwise the single `src` attribute is used and no picker shows.

### Events

- `settingschange` (CustomEvent) emitted on save, so a host *can* observe/mirror
  settings externally. The component self-persists regardless.

## Panel UI & structure (inline view swap)

A settings gear ⚙ lives in the control row (hidden when `no-settings`). Clicking
it swaps the **tracklist region** for the settings view; now-playing / progress /
controls stay in place. A back/✕ control returns to the tracklist.

Panel sections:

1. **Provider** — select from the allowed set.
2. **Configuration** — credential fields for the selected provider (mirrors
   today's harness fieldsets). `mock` / `youtube` show "no configuration needed."
3. **Connection** — the auth slot (see below) plus a status line, where
   auth-capable providers render Connect/Link/Disconnect.
4. **Actions** — "Refresh availability" (clear resolved-id cache + re-scan) and an
   advanced "Debug diagnostics" toggle.
5. **Apply/Save** — persists user settings and re-initializes the provider in place.

The playlist picker is **not** here — it is top-level player chrome.

## Provider auth integration (panel auth slot)

Add an optional method to the `AudioProvider` interface:

```ts
// Optional: render auth controls (Connect/Link/Disconnect) into a host-provided
// element — the settings panel's auth slot. Providers without interactive auth
// omit it. Falls back to the attach()/video target when not given a slot.
attachAuth?(element: HTMLElement): void;
```

- The panel renders an auth-slot element in the component's shadow DOM (same
  origin/tree as `.video` today).
- The component calls `attachAuth(slot)` around `initialize()`.
- `SpotifyProvider` and `PlexProvider` render their existing Connect/Link/
  Disconnect/Unlink buttons into the `attachAuth` element when provided, falling
  back to the `attach`/`.video` target otherwise. Video-only usage still works.
- `onReset` is unchanged — it still clears stale availability marks on session
  change.

This is a small, additive change to `SpotifyProvider.renderControl` and
`PlexProvider.renderLink/renderUnlink` (target = `authTarget ?? target`). It
avoids a cross-provider auth-interface rewrite while respecting that each
provider's auth flow is legitimately different (OAuth popup vs. PIN poll).

## Runtime re-init & data flow

Split the current one-shot `loadAndInit()` into two reusable steps:

- `loadPlaylist()` — fetch + parse the manifest. Runs on `src` / playlist change.
- `initProvider()` — create → `attach` / `attachAuth` → `initialize` the provider,
  build the `PlaybackController`, start the availability sweep. Runs on
  provider / config / debug change.

**Applying settings:** dispose the current provider + controller, clear
availability marks, then call `initProvider()` with the new effective config — **no
element remount**, since the component owns its state. `handleProviderReset()`'s
existing mark-clearing logic is reused.

**Switching playlist** (top-level picker): re-run `loadPlaylist()` and reset the
controller queue to the new tracks.

**Debug toggle:** folded into effective config; applying re-initializes (accepted
as the simplest correct behavior).

## Dev harness rework (`index.html`)

Credential entry now lives in the player, so the harness slims down:

- **Removed:** per-provider credential fieldsets (subsonic / spotify / plex /
  jellyfin) — entered in the component panel now.
- **Kept as dev-only:** preset playlists (rewired to author `<byom-playlist>`
  children, exercising the real top-level picker), "random from Navidrome," and a
  deployment-config area to test host-side attributes (`spotify-client-id`,
  `youtube-api-key`, …).
- "Clear cache & re-scan" moves into the panel as "Refresh availability"; the
  harness may keep a dev shortcut if convenient.

This satisfies "rework much of the dev harness into a user-facing settings panel":
the config UI becomes component-native; the harness keeps only genuine dev
scaffolding.

## Testing

- **Regression (hard gate):** all Phase-3 behavior tests (controller, playback,
  availability sweep) pass after the `loadAndInit` split.
- **New unit tests (happy-dom):**
  - settings load / merge / save round-trip
  - deployment-⊕-user precedence
  - `providers` allowlist parsing
  - `<byom-playlist>` child parsing → top-level picker
  - re-init path (dispose old provider + init new provider in place)
  - `no-settings` hides the gear
  - panel open/close view swap
  - `attachAuth` renders into the slot when provided; falls back to `.video` when
    absent
- **Deferred:** visual/feel polish, theming, skins → issue #1 session.

## Verification

- [ ] `npm test` — all tests pass (regression + new).
- [ ] `npm run build` succeeds; `npm run lint` passes.
- [ ] Manual: open the panel, switch provider, enter creds, apply, playback works;
      reload the page and settings persist.
- [ ] Manual: `no-settings` hides the gear; child `<byom-playlist>` elements
      produce a top-level picker.
- [ ] Manual: Spotify Connect / Plex Link render in the panel and still complete
      their flows.
