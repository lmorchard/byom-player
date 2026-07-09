# Spec: Plex provider for byom-player

## Summary

Add a `plex` audio provider that plays JSPF tracks from a Plex Media Server's
music library. Playback is HTML5 `<audio>` — the same mechanism as the Subsonic
provider — so the provider is, structurally, Subsonic with Plex's API surface
(auth + search + part URLs) swapped in.

Two auth paths, chosen for end-user convenience:

- **Token-in** — config supplies `baseUrl` + `token` (an `X-Plex-Token`). Mirrors
  Subsonic; works immediately for a homelab.
- **PIN "Link Plex" flow** — provider-owned, poll-based device link via `plex.tv`
  (no password, works with 2FA), followed by server/connection discovery. No
  redirect and **no `callback.html`** (unlike Spotify) because Plex's PIN model
  is poll-based.

## Motivation

byom-player already targets self-hosted music (Subsonic) and public sources
(YouTube, Spotify). Plex is a very common self-hosted music home, and it maps
almost 1:1 onto the existing Subsonic playback path, so it's high-value for low
structural risk.

## Goals

- A `plex` provider selectable via `registry.ts`.
- Full playback (state, progress, seek, auto-advance) through HTML5 `<audio>`,
  reusing the Subsonic pattern.
- Token-in config path for power users / homelab.
- Turnkey PIN "Link Plex" flow with automatic server/connection discovery.
- Reuse the generic `resolutionCache` and audio-event wiring.

## Non-goals

- Transcoding. MVP is **direct-play** of the media part; exotic codecs that the
  browser can't decode are a follow-up (Plex transcode endpoint).
- Playlist / library browsing UI. Resolution is by `artist + title` search only.
- Video. Music tracks only.
- Server-side proxying. Fully client-side (the browser talks to `plex.tv` and the
  Plex server directly).

## Constraints & ground truth

- **CORS / mixed content** — the browser hits the Plex server directly, so the
  server must allow the page's origin. Plex's `*.plex.direct` HTTPS certs avoid
  mixed-content when the page is HTTPS; a local `http://` server from an HTTPS
  page is the usual friction (same story as Subsonic).
- **plex.tv API CORS** — the PIN/resources calls run from the browser; Plex's own
  web clients do this, so it's expected to work, but it's the one thing to
  confirm live in Phase 2.
- **Token in `localStorage`** — fine for personal use; mild exposure on shared
  machines. Standard for a client-only app.
- **Direct-play codec support** — mp3/aac/flac/ogg generally play; unsupported
  codecs fail to decode (surfaced as a normal playback error / miss) until
  transcode support lands.
- Follow repo conventions: Lit + TS, Vitest + happy-dom, no `node:*` in `src`,
  live-server behavior verified manually.

## Architecture

Playback is HTML5 `<audio>` (like Subsonic), so there is **no engine seam**. The
only machinery beyond Subsonic is auth/discovery, which earns a small subdir:

```
src/providers/plex/
  PlexProvider.ts   # AudioProvider: resolve → stream URL → <audio>
  types.ts          # PlexConfig, PlexAuthLike, discovered-server shapes
  auth.ts           # PIN link flow, server/connection discovery, token cache
  PlexProvider.test.ts
  auth.test.ts
```

Reuses `../resolutionCache` (`trackKey`, `LocalStorageResolutionCache`) and
`../types`. `registry.ts` gains `case 'plex'`.

### PlexConfig

```ts
interface PlexConfig {
  baseUrl?: string;    // direct server URL   ┐ token-in path (used as-is if both set)
  token?: string;      // X-Plex-Token         ┘
  serverName?: string; // optional: auto-select this server in the PIN flow
  product?: string;    // X-Plex-Product label (default 'byom-player')
  debug?: boolean;
  cache?: boolean;                 // default on
  resolutionCache?: ResolutionCache; // test / custom backend injection
  auth?: PlexAuthLike;             // test injection of the PIN/discovery client
}
```

**Path selection (`initialize`):** if `baseUrl` && `token` → use directly. Else
if a cached linked session exists → use it. Else → render a **"Link Plex"**
button in the `attach` surface and run the PIN flow on click.

### Auth (`auth.ts`)

- **Client identity:** a stable `X-Plex-Client-Identifier`, generated once and
  persisted in `localStorage`. Sent (with `X-Plex-Product`, `X-Plex-Version`,
  `Accept: application/json`) on all `plex.tv` calls.
- **PIN flow:**
  1. `POST https://plex.tv/api/v2/pins?strong=true` → `{ id, code }`.
  2. Open `https://app.plex.tv/auth#?clientID=<id>&code=<code>` in a popup.
  3. Poll `GET https://plex.tv/api/v2/pins/{id}` until `authToken` is present,
     then close the popup. (Bounded polling with an overall timeout; stop if the
     popup is closed.)
  4. Persist the account `authToken` in `localStorage`.
- **Server discovery:** `GET https://plex.tv/api/v2/resources?includeHttps=1`
  (account token) → keep resources whose `provides` includes `server`.
- **Server selection:** if `serverName` matches one, use it; else if exactly one,
  auto-select; else surface the list for a small picker in the attach surface.
- **Connection selection:** iterate the chosen resource's `connections`,
  preferring `local` then remote `*.plex.direct` (HTTPS); pick the first that
  answers `GET {uri}/identity` (token attached). Use its `uri` as `baseUrl` and
  the resource's per-server `accessToken` as `token`.
- **Persistence:** cache the resolved `{ baseUrl, token }` (keyed by client id) in
  `localStorage`. `logout()` clears it (surfaced later as an "Unlink" control,
  paralleling Spotify's disconnect). Thereafter the provider behaves like
  token-in.

`PlexAuthLike` (small, for test fakes): `hasSession()`, `getSession(): Promise<{
baseUrl, token } | null>`, `link(): Promise<{ baseUrl, token }>`,
`logout(): void`.

### Playback (mirrors Subsonic)

One `Audio()` element; per-track `load(track)` resolves then sets `audio.src`;
state from `playing` / `pause` / `ended` / `error`; progress from `timeupdate` /
`durationchange`; `seek` via `currentTime`; `checkAvailability` via `resolve`.
Resolution cache + stale-id recovery follow the Subsonic pattern (a cached part
key that errors before first play is evicted and re-resolved once).

### Resolution

`resolve(track)`:
- Cache check (per-server scope `plex:<baseUrl>`), like Subsonic.
- `GET {base}/library/search?query="{artist} {title}"&searchTypes=music&limit=5`
  (token attached, `Accept: application/json`). Take the best `Metadata` entry of
  type `track`; read `Media[0].Part[0].key`.
- `streamUrl = {base}{part.key}?X-Plex-Token={token}` (direct-play).
- Cache the part key on hit; record a miss on none. Transient failures retry then
  throw (→ `error`); a clean "no match" → `unavailable`.

## Auth headers / request shape

- **Plex server requests:** `X-Plex-Token` as a query param is sufficient;
  `Accept: application/json` for metadata endpoints.
- **plex.tv requests:** `X-Plex-Client-Identifier`, `X-Plex-Product`,
  `X-Plex-Version`, `Accept: application/json`, plus the token where required.

## Testing

Unit (Vitest + happy-dom; fakes/mocked `fetch`):

- Resolution: query building, `Metadata`→part-key parsing, `streamUrl`
  assembly, hit/miss/transient outcomes, cache hit/miss.
- Auth: PIN state machine (create → poll-until-token, popup-closed abort,
  timeout), server selection (single/auto, `serverName` match, multi→picker
  signal), connection selection (prefer local, fall back to plex.direct,
  `/identity` probe), session persistence + `logout`.
- Provider: path selection (token-in vs linked-session vs Link button), state
  mapping, seek/progress via a stubbed audio element where practical.

Manual / browser (Les has a personal Plex server):

- Live token-in playback against the real server (resolve, play, seek,
  auto-advance).
- Live PIN "Link Plex" round-trip: link, server auto-select (and picker if
  multiple), connection selection, then playback.
- Confirm `plex.tv` and server CORS behavior from the page origin.

## Dev harness & docs

- Harness Plex option: `baseUrl` + `token` fields **and** a "Link Plex" button
  path. No `callback.html` (poll-based).
- README: config keys, both auth paths, direct-play/codec + CORS notes, the
  X-Plex-Token how-to. AGENTS.md: a `plex` provider bullet.

## Known limitations / risks

- Direct-play only (transcode deferred) — some codecs won't play.
- CORS / mixed content for local `http://` servers from an HTTPS page.
- `plex.tv` browser CORS for PIN/resources — verify live in Phase 2.
- Multi-server / multi-connection accounts add selection UI + reachability
  probing.
- Refresh/token in `localStorage`.

## Phasing

1. **Phase 1 — token-in provider:** `PlexProvider` (config `baseUrl` + `token`),
   resolution, streaming, `<audio>` wiring, registry, unit tests. A working
   homelab provider on its own.
2. **Phase 2 — PIN link flow:** `auth.ts` (PIN + discovery + selection +
   persistence), "Link Plex" / picker UI in the attach surface, `disconnect`,
   unit tests.
3. **Phase 3 — harness + docs.**

## Success criteria

- `npm run lint && npm test && npm run build` green.
- Unit tests cover resolution, the PIN state machine, and server/connection
  selection.
- Token-in: a real track resolves and plays from Les's Plex server with working
  seek + auto-advance (manual).
- PIN flow: linking on a static page yields a playable session (server
  auto-selected, or picked when multiple) (manual).
