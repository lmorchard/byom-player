# Spec: Spotify provider for byom-player

## Summary

Add a `SpotifyProvider` that lets a listener play a JSPF playlist through
Spotify from within `<byom-player>`. It follows the existing `AudioProvider`
seam and is the first provider with its own OAuth flow and two swappable
playback engines:

- **Web Playback SDK** — full-track, headless playback with real seek/position.
  Requires Spotify **Premium** and an OAuth token.
- **Embed iframe** — no-auth fallback. Free/logged-out listeners get 30-second
  previews; the listener's own Premium login yields full tracks. Visible Spotify
  player chrome, limited control API.

The provider owns the OAuth (Authorization Code + **PKCE**) flow itself via a
popup, works on a **fully static site with no backend**, and degrades from the
SDK tier to the embed tier automatically when the account isn't Premium.

## Motivation

`byom-sync` extracts playlists *from* Spotify; letting `byom-player` play them
back *through* Spotify closes the loop. Because the byom-sync JSPF export already
writes the Spotify URL into each track's `location`, resolution is trivial — no
search/quota step (unlike the YouTube provider).

## Goals

- A `spotify` provider selectable through the existing `registry.ts`.
- Turnkey "Connect Spotify" login initiated from inside the component.
- Full-track playback (seek, position, auto-advance) for Premium listeners via
  the Web Playback SDK, mapped onto the standard `AudioProvider` interface.
- Automatic fallback to the Spotify embed for non-Premium / non-authenticated
  listeners, with byom-player's own controls driving it and state kept in sync.
- Works on a **static host with zero server-side endpoints**.

## Non-goals

- Server-side token proxying or a hosted auth backend (explicitly avoided; PKCE
  makes it unnecessary).
- Removing or restyling Spotify's embed player chrome (not possible via the
  embed API).
- Reliable detection of preview-vs-full playback (only inferable from duration).
- Playlist *editing* / write-back to Spotify. Playback only.

## Constraints & ground truth

- **Premium is required** for full-track SDK playback. Free accounts are
  rejected at connect time (`account_error`) with no workaround → embed tier.
- **Static-hosting works** because PKCE has no client secret: the `client_id` is
  public, the token exchange/refresh are direct CORS fetches to
  `accounts.spotify.com/api/token`, and the redirect target is a static
  `callback.html`.
- **The embed iframe cannot be headless** — Spotify's visible player face always
  renders in the attach surface. "Integration" means byom-player's controls
  drive it and `playback_update` events keep state in sync, not that the chrome
  is hidden.
- **Refresh token lives in `localStorage`** — acceptable for personal/homelab
  use; a mild exposure on shared machines. Refresh tokens rotate on each use.
- Follow existing repo conventions: Lit + TS, Vite lib build, Vitest + happy-dom,
  no `node:*` imports in `src`, browser-only engines left to manual testing (as
  with `YtIframeEngine`).

## Architecture

New provider directory (the others stay flat single files; this one carries auth
+ two engines, so it earns a subdir):

```
src/providers/spotify/
  SpotifyProvider.ts     # AudioProvider impl: resolution, engine selection, plumbing
  pkce.ts                # code_verifier / S256 code_challenge, authorize-URL builder
  auth.ts                # popup login, code->token exchange, refresh, TokenStore
  WebPlaybackEngine.ts   # real SDK engine (Premium) — browser-only, manual
  EmbedEngine.ts         # real IFrame-embed engine (free/preview) — browser-only, manual
  types.ts               # SpotifyConfig, SpotifyEngine interface
```

`registry.ts` gains a `case 'spotify'`.

### SpotifyEngine seam

Mirrors the existing `YouTubeEngine` seam so `SpotifyProvider` is unit-tested
against a fake and the real engines stay browser-only:

```ts
interface SpotifyEngine {
  ready(): Promise<void>;
  attach(element: HTMLElement): void;   // embed mounts here; SDK is headless
  load(uri: string): Promise<void>;     // full uri, e.g. 'spotify:track:<id>'
  play(): void;
  pause(): void;
  seek(positionMs: number): void;
  currentTimeMs(): number;
  durationMs(): number;
  onState(cb: (state: ProviderState) => void): void;
  destroy(): void;
}
```

### SpotifyConfig

```ts
interface SpotifyConfig {
  clientId: string;        // required; public Spotify app client id
  redirectUri: string;     // required; URL of the static callback.html (must be registered)
  scopes?: string[];       // default: ['streaming','user-read-email','user-read-private']
  deviceName?: string;     // SDK device name; default 'byom-player'
  forceEmbed?: boolean;    // skip SDK entirely (free-only sites / testing)
  engine?: SpotifyEngine;  // test injection
  auth?: AuthClient;       // test injection (popup/exchange/refresh/TokenStore)
  debug?: boolean;
}
```

## Behavior

### Auth / PKCE (in `pkce.ts` + `auth.ts`)

1. `pkce.ts`: generate a random `code_verifier`; derive the S256
   `code_challenge` via `crypto.subtle`; build the `accounts.spotify.com/authorize`
   URL with `response_type=code`, `client_id`, `redirect_uri`, `scope`,
   `code_challenge_method=S256`, `code_challenge`.
2. `auth.ts` `beginLogin()` (called on a user click): open a **popup** to the
   authorize URL. `callback.html` on the redirect origin `postMessage`s the
   `?code=` back to `window.opener` and closes. The opener validates the message
   origin, then exchanges `code` + `code_verifier` at
   `accounts.spotify.com/api/token` (direct CORS fetch, no secret).
3. `TokenStore` persists `{ accessToken, refreshToken, expiresAt }` in
   `localStorage` keyed by `clientId`. `getValidToken()` returns the cached token
   or refreshes (`grant_type=refresh_token` + `client_id`), persisting the
   rotated refresh token. This is the function the SDK's `getOAuthToken` calls.

### Engine selection (`SpotifyProvider.initialize`)

- `forceEmbed` → `EmbedEngine`.
- else if `TokenStore` has a usable token (returning visitor) → attempt
  `WebPlaybackEngine`; on `account_error` (not Premium) → fall back to
  `EmbedEngine`.
- else (no token) → render a **"Connect Spotify"** button into the attach
  surface. The click supplies the required user gesture, runs `beginLogin()`,
  then proceeds as the "token present" branch.

### WebPlaybackEngine (Premium)

- Load `https://sdk.scdn.co/spotify-player.js`
  (`window.onSpotifyWebPlaybackSDKReady`).
- `new Spotify.Player({ name, getOAuthToken, volume })`; `connect()`.
- Listen for `ready` (`device_id`), `player_state_changed`,
  `not_ready`, and the error events (`initialization_error`,
  `authentication_error`, `account_error`, `playback_error`). `account_error`
  triggers the embed fallback; others map to `error`.
- `load(trackId)` drives the Connect Web API:
  `PUT https://api.spotify.com/v1/me/player/play?device_id=<id>` with
  `{ uris: ['spotify:track:<id>'] }` and the bearer token.
- Position doesn't self-tick → a 250ms ticker polls `getCurrentState()` and
  feeds `onProgress` (same pattern as the YouTube provider).

### EmbedEngine (free / preview)

- Load `https://open.spotify.com/embed/iframe-api/v1`
  (`window.onSpotifyIframeApiReady`).
- `IFrameAPI.createController(attachEl, { uri }, cb)`; use `loadUri`, `play`,
  `pause`, `seek` (seconds), `destroy`.
- `playback_update` events give `{ isPaused, position, duration }` in ms → feed
  `onProgress` and map to `playing`/`paused`. Emit `ended` by detecting
  `position >= duration` (no clean end event).

### SpotifyProvider (AudioProvider surface)

- `attach(element)`: remember the surface; render connect button / status / embed
  iframe there. Auth stays entirely inside the provider (no core interface
  change).
- `load(track)`: parse the Spotify track id from `track.location` (accept both
  `https://open.spotify.com/track/<id>` and `spotify:track:<id>`), build the
  `spotify:track:<id>` uri, and pass it to `engine.load(uri)`. No / non-Spotify
  location → `unavailable` (controller skips cleanly).
- `play` / `pause` / `seek`: delegate to the active engine.
- `onStateChange` / `onProgress`: wired from the active engine (+ SDK ticker).
- `checkAvailability(track)`: implemented — a free, network-less URL parse
  returning `available` when the location yields a Spotify id, else
  `unavailable`. Feeds the background prescan at zero quota cost (unlike YouTube,
  which omits it).
- `dispose()`: destroy engine, stop ticker, close popup if open, remove
  listeners.

## Dev harness & deployment

- `index.html`: add a Spotify option with `clientId` / `redirectUri` inputs.
- `public/callback.html`: static postMessage landing page for the popup.
- Docs: Spotify dashboard setup (register app → public `client_id`; register each
  deploying site's `callback.html` as a redirect URI) and the static-hosting
  story.

## Testing

Unit (Vitest + happy-dom, fakes/mocks — no live Spotify):

- `pkce.ts`: verifier randomness/shape, S256 challenge derivation, authorize-URL
  assembly.
- `auth.ts`: code→token exchange and refresh with mocked `fetch`; `TokenStore`
  with a fake storage; popup `postMessage` handler with a fake popup + dispatched
  `MessageEvent` (including origin rejection).
- `SpotifyProvider`: `location` parsing (both URL forms + bad/absent →
  `unavailable`), state mapping, ticker progress, and the tiering decision
  (`account_error` → embed engine selected) via a fake `SpotifyEngine`.

Manual / browser-only (documented, like `YtIframeEngine`): the real
`WebPlaybackEngine` and `EmbedEngine`, and a live Premium login round-trip.

## Known limitations / risks

- Premium required for full tracks; free listeners get 30s previews via embed.
- Embed chrome is unremovable.
- Preview-vs-full is not cleanly detectable (only inferable from ~30s duration).
- Auto-advance through the queue on the embed tier may hit browser autoplay
  gating after the first gesture — flagged for manual validation.
- Refresh token in `localStorage` — fine for personal/homelab, mild exposure on
  shared machines.

## Phasing

One spec, executed in independently-reviewable phases:

1. **Phase 1** — `pkce.ts` + `auth.ts` + `WebPlaybackEngine` + `SpotifyProvider`
   + registry + unit tests (the real Premium experience).
2. **Phase 2** — `EmbedEngine` fallback + full control/state integration + tests.
3. **Phase 3** — dev harness Spotify option, `public/callback.html`, docs.

## Success criteria

- `npm run lint && npm test && npm run build` all green.
- Unit tests cover PKCE, auth/token, resolution, tiering, and progress.
- A Premium listener can click "Connect Spotify", authenticate via popup on a
  static site, and hear full-track playback with working seek and auto-advance
  (verified manually).
- A non-Premium/free listener falls through to the embed tier and can play
  (previews) with byom-player's controls in sync (verified manually).
