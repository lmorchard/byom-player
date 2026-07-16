# byom-player

A framework-agnostic **Lit web component** that plays [JSPF](https://xspf.org/jspf/)
playlists through swappable audio providers. It's the playback frontend for
playlists exported by the [byom-sync](https://github.com/lmorchard/byom-sync)
CLI, but it consumes standard JSPF, so it works with any JSPF source.

The component is a state machine for UI and queue management; actual audio is
delegated to pluggable **Audio Provider** adapters.

## Features

- Loads a standard JSPF manifest and renders header, now-playing, controls, and a
  clickable tracklist
- Swappable providers: `mock` (no infra, for demos/dev), `subsonic` (any
  Subsonic / OpenSubsonic server — Navidrome, gonic, Airsonic, LMS, …),
  `youtube` (hidden or **visible** iframe; the universal public-visitor
  fallback), `spotify` (full-track playback for Premium listeners via the
  Web Playback SDK, with a 30-second-preview embed fallback), and `plex`
  (direct-play from a Plex Media Server; token or PIN "Link Plex" auth)
- Auto-advance, prev/next, click-to-play, and **shuffle**
- Resilience for real-world libraries: retry with backoff, a circuit breaker for
  flaky/rate-limiting servers, and lazy-skip past tracks you don't have
- Optional **background availability prescan** with three track states
  (pending / available / unavailable)
- Themable via CSS variables; ships as a single ES module (Vite library build)

## Usage

Load a pinned release from npm via jsDelivr (recommended), self-host the
downloadable release asset, or build it yourself (see Development):

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@lmorchard/byom-player@1.0.3/dist/byom-player.js"
></script>

<byom-player src="/playlists/road-trip.jspf.json" provider="subsonic"></byom-player>
```

> Pin an explicit version. jsDelivr serves it with the correct MIME type and CORS
> headers, and because a published npm version is immutable it's never
> cache-stale. For the bleeding edge instead, the `dist` branch is rebuilt on
> every push to `main` (`…/gh/lmorchard/byom-player@dist/byom-player.js`) — but as
> a mutable ref it can serve a stale cached build until the CDN refreshes. The
> GitHub release asset (`…/releases/download/vX.Y.Z/…`) is a download for
> self-hosting — it can't be used directly in a `<script>` tag (served as
> `application/octet-stream`). See [Releasing](#releasing).

### Configuring providers

There are two layers of configuration:

- **User settings** — which provider is active and its credentials — are entered
  in the component's own **settings panel** (the ⚙ button) and persisted to this
  browser's `localStorage`. This is the primary path; see [Settings panel](#settings-panel).
- **Deployment defaults** — host-set values like the Spotify client ID or a
  YouTube API key — are supplied as **HTML attributes** (attribute-first, so a
  static-site generator can author them). See the [Properties / attributes](#properties--attributes) table.

For programmatic hosts, the `providerConfig` JS property is still available as an
escape hatch. It seeds the deployment defaults for the initial provider; user
settings entered in the panel layer on top.

```js
const player = document.querySelector('byom-player');
player.providerConfig = {
  baseUrl: 'https://music.example.com',
  username: 'you',
  password: 'secret', // converted to a salted token in-browser; never sent as plaintext
  // or: apiKey: '...'  (OpenSubsonic)
};
```

### Properties / attributes

All host-side config is settable as an HTML **attribute** (the deployment path)
unless noted as a JS property.

| Attribute / property      | Default  | Notes                                                                   |
| ------------------------- | -------- | ----------------------------------------------------------------------- |
| `src`                     | `''`     | URL to the JSPF manifest (single playlist)                              |
| `provider`                | `'mock'` | Initial selection; a user's panel choice (persisted) wins once set      |
| `theme`                   | `''`     | Named color theme; `''` = Auto (follow OS). Persisted panel choice wins |
| `providers`               | (all)    | CSV allowlist of selectable providers, e.g. `"youtube,subsonic"`        |
| `no-settings`             | `false`  | Boolean attribute; hides the settings gear/panel                        |
| `spotify-client-id`       | `''`     | Deployment default: Spotify app client ID                               |
| `spotify-redirect-uri`    | (origin) | Deployment default: Spotify OAuth redirect URI                          |
| `youtube-api-key`         | `''`     | Deployment default: YouTube Data API key (private/dev installs)         |
| `youtube-search-endpoint` | `''`     | Deployment default: server-side YouTube search proxy URL                |
| `prescan`                 | `true`   | Background availability check after load                                |
| `skip-delay-ms`           | `400`    | Throttle between auto-skips                                             |
| `debug`                   | `false`  | Console diagnostics; also toggleable in the settings panel              |
| `providerConfig`          | `{}`     | JS property only: deployment-defaults escape hatch (see above)          |
| `providerFactory`         | —        | JS property only: custom provider construction (tests / host providers) |

### Multiple playlists

Offer a top-level playlist picker by authoring `<byom-playlist>` children instead
of a single `src`. They're read on connect (invisible; the component renders in
Shadow DOM); the first is the initial selection.

```html
<byom-player provider="youtube" providers="youtube,subsonic">
  <byom-playlist title="Road Trip" src="/road-trip.jspf.json"></byom-playlist>
  <byom-playlist title="Chill Evening" src="/chill.jspf.json"></byom-playlist>
</byom-player>
```

### Settings panel

The component ships with an in-player settings panel, opened from the ⚙ button in
the controls (hide it with the `no-settings` attribute). From the panel a user can:

- **Choose an appearance** — Auto (follow OS light/dark) or a named theme.
- **Pick a provider** from the allowed set and enter its **credentials** (Subsonic
  / Plex / Jellyfin). `mock` and `youtube` need no credentials.
- **Connect / disconnect** interactive auth (Spotify Connect, Plex Link) — the
  provider's auth controls render inside the panel.
- **Refresh availability** (clears the resolved-id cache and re-scans) and toggle
  **debug diagnostics**.

Applying persists the settings to `localStorage` (key `byom-player:settings:v1`),
re-initializes the active provider in place, and emits a `settingschange` event.

> **Credential storage.** Credentials entered in the panel (including passwords)
> are stored in this browser's origin-scoped `localStorage` in plaintext — the
> same posture as a typical single-page app. For a locked-down or public embed
> where users shouldn't enter credentials, set `no-settings` and supply any
> needed config as deployment attributes.

### Theming & skins

Styling has two layers over one clean Shadow-DOM structure:

- **Theme** — a palette expressed as CSS custom properties. Switch built-in themes
  via the `theme` attribute / Appearance picker, or override any token from the
  host (host inline values always win).
- **Skin** — a stylesheet that restyles the component's exposed `::part()`s. A
  skin can move, reshape, and re-space the controls without any change to the
  component.

**Theme tokens** (defaults are the Auto light palette; the Auto dark palette
applies via `prefers-color-scheme`):

| Token                  | Role                                      |
| ---------------------- | ----------------------------------------- |
| `--byom-bg`            | base background                           |
| `--byom-surface`       | elevated surfaces (settings card, embed)  |
| `--byom-text`          | primary text                              |
| `--byom-text-muted`    | secondary text, timestamps, dimmed states |
| `--byom-accent`        | accent / active / fills                   |
| `--byom-on-accent`     | text/glyph on an accent fill              |
| `--byom-border`        | hairlines, control outlines               |
| `--byom-font`          | font stack                                |
| `--byom-border-radius` | corner rounding                           |

```css
/* Override individual tokens (wins over any built-in theme) */
byom-player {
  --byom-accent: #ff0055;
  --byom-border-radius: 8px;
}
```

**Built-in themes** (`theme="…"`): `daylight`, `midnight` (the Auto light/dark
defaults), `terminal`, `sunset`, `paper`, `dracula`. With no `theme` set, the
component follows the OS via `prefers-color-scheme`.

**Skin parts** — target these with `::part()`:

`header`, `art`, `meta`, `title`, `creator`, `meta-line`, `description`,
`transport`, `control` (+ `prev` / `play` / `next` / `shuffle` / `gear`),
`progress`, `seek`, `filter`, `filter-input`, `filter-clear`, `stage`,
`tracklist`, `track` (carries `data-state="active|orphan|unavailable|pending"`),
`track-number`, `video`, `settings`.

```css
/* A skin: restyle via parts + tokens only — no component change */
byom-player::part(controls) {
  justify-content: center;
}
byom-player::part(track)[data-state='unavailable'] {
  opacity: 0.5;
}
```

## Manifest

Standard JSPF. `sync_state` (orphaned-track info from byom-sync) is read from a
JSPF track `extension` when present and ignored otherwise, so generic JSPF works.

The header shows the playlist `title`, `creator`, and a meta line
(`{n} tracks · {total duration} · {creation date}`) derived from the tracks and
the JSPF `date`. The playlist-level **`annotation`** field is rendered as a short
description blurb with a tiny inline-markdown subset — `**bold**`, `*italic*`,
and `[links](https://…)` (other markdown is ignored; link hrefs are restricted to
http(s)/mailto). Per-track `duration` drives the right-aligned times in the list.

## Subsonic auth

The `subsonic` provider uses only core Subsonic endpoints (`search3`, `stream`),
so it's not Navidrome-specific. Supply one of:

- **username + password** — a random-salted token (`md5(password + salt)`) is
  computed in the browser; the plaintext password is never sent. (Recommended;
  this is the Navidrome path — Navidrome has no separate API key to generate.)
- **apiKey** — OpenSubsonic API-key auth, for servers that issue one.
- **token + salt** — precomputed classic Subsonic token auth.

The server must allow the page's origin (CORS), or be reached via a same-origin
proxy.

## YouTube

The `youtube` provider plays via the YouTube IFrame API and is the universal
public-visitor fallback. If the component has a visible `.video` region, the
player renders there (video); otherwise it plays through a hidden 1×1 iframe
(audio-only).

Resolution turns `"{artist} {title} audio"` into a videoId; configure one:

- **searchEndpoint** — a backend you host: `GET {searchEndpoint}?q=<query>` →
  `{ videoId }`. Keeps API keys server-side (safe for public bundles).
- **apiKey** — the YouTube Data API directly. The key is visible to the client,
  so **private/dev only**.

The provider intentionally omits the availability prescan (a full-playlist
prescan would burn YouTube Data API quota — ~100 units/search); resolution
happens lazily on play.

## Spotify

The `spotify` provider plays JSPF tracks through Spotify. Resolution is free —
it reads each track's Spotify URL straight from the manifest (byom-sync writes
it into the JSPF `location`), so there's no search step. It runs in two tiers:

- **Web Playback SDK (Premium)** — full-track, headless playback with real
  seek/position. Requires the listener to have **Spotify Premium** and to
  authenticate.
- **Embed iframe (fallback)** — for listeners who haven't connected. In practice
  the embed plays **30-second previews** (this holds even for signed-in Premium
  listeners — full-track playback is what the SDK tier is for). A fully
  signed-out visitor may get no playable source for some tracks. Spotify's embed
  renders its own visible player, so the component's controls drive it and stay
  in sync, but the Spotify chrome can't be hidden.

The provider owns a client-side **PKCE** login: it renders a "Connect Spotify"
button, opens a popup to Spotify's authorize page, and exchanges the code for a
token — no client secret, no backend. Non-Premium accounts fall back to the
embed automatically, and a "Disconnect Spotify" button clears the session.

Until you connect, the provider mounts the embed so playback still works for a
listener already signed into Spotify in that browser — as **30-second previews**
(the embed is preview-only in practice, even for Premium). A fully signed-out
visitor may get no playable source for some tracks. Connecting is the path to
full-track playback (Premium, via the SDK).

```js
player.provider = 'spotify';
player.providerConfig = {
  clientId: 'your-spotify-app-client-id', // public; safe to ship
  redirectUri: 'https://yoursite.example/callback.html',
  // optional (defaults shown):
  // scopes: ['streaming', 'user-read-email', 'user-read-private',
  //          'user-read-playback-state', 'user-modify-playback-state'],
  // deviceName: 'byom-player',
  // forceEmbed: true, // skip the SDK entirely (free-only sites)
};
```

### Fully static hosting (no backend)

This works on a static host — GitHub Pages, S3, Netlify — with **no server-side
endpoints**, because PKCE has no client secret to protect:

1. Create a Spotify app in the [developer dashboard](https://developer.spotify.com/dashboard)
   and copy its **Client ID** (public).
2. Register your site's callback page (e.g.
   `https://yoursite.example/callback.html`) as a **Redirect URI** on the app.
3. Ship `callback.html` (a copy lives in this repo's `public/callback.html`) — a
   static page that posts the auth code back to the opener and closes. The token
   exchange and refresh are direct CORS fetches from the browser to
   `accounts.spotify.com`.

Notes: full-track SDK playback still requires Premium regardless of hosting; the
refresh token is kept in `localStorage` (fine for personal use, a mild exposure
on shared machines); and each deploying origin's `callback.html` must be
registered as a Redirect URI.

## Plex

The `plex` provider plays music from a Plex Media Server. Like Subsonic, it
resolves a track by `artist + title` search and plays the result **direct-play**
through an HTML5 `<audio>` element (no engine seam). Two auth paths:

```js
player.provider = 'plex';
// Token-in (homelab / power users): supply the server + an X-Plex-Token.
player.providerConfig = {
  baseUrl: 'https://<id>.plex.direct:32400', // or http://<lan-ip>:32400
  token: 'your-X-Plex-Token',
  // optional: serverName, product
};
// — or — leave baseUrl/token unset to use the in-player "Link Plex" button.
player.providerConfig = {};
```

- **Token-in** — provide `baseUrl` + `token`. Get an `X-Plex-Token` from any
  authenticated Plex web request (browser dev tools → a request's
  `X-Plex-Token`), or your account's authorized-devices page.
- **PIN "Link Plex"** — with no `baseUrl`/`token`, the provider renders a "Link
  Plex" button. It creates a plex.tv PIN, opens `app.plex.tv` for you to
  authorize, polls for the token, then discovers your server(s) — auto-selecting
  a single server (or one matching `serverName`) and otherwise showing a picker.
  Fully client-side; **no redirect page needed** (poll-based, unlike Spotify).
  Once linked, an "Unlink Plex" button clears the stored session. The background
  availability prescan is skipped until a session exists, so an unlinked player
  never probes a server.

**Notes:** direct-play only for now — a codec the browser can't decode won't play
(transcode support is a follow-up). The browser talks to your server directly, so
it must allow the page's origin (CORS); `*.plex.direct` HTTPS certs avoid
mixed-content from an HTTPS page, while a local `http://` server from an HTTPS
page is the usual friction (same as Subsonic).

## Development

```sh
npm install
npm run dev     # Vite dev server + harness (index.html)
npm test        # Vitest
npm run lint    # ESLint + Prettier
npm run build   # single ES module -> dist/byom-player.js
```

The dev harness (`index.html`) has a preset playlist dropdown, provider/auth
config (saved to localStorage only), and a "play random from Navidrome"
diagnostic. The dev server binds to `http://127.0.0.1:5173` (not `localhost`)
because Spotify's dashboard only accepts `127.0.0.1` as a loopback redirect URI,
so the Spotify PKCE login works out of the box.

### Refreshing the demo playlists

The JSPF files under `public/playlists/` are generated from the playlist "hub"
YAML in the sibling [byom-sync](https://github.com/lmorchard/byom-sync) repo
(`../byom-sync/playlists/`) via its `export jspf` command. Regenerate them (e.g.
after enriching the source YAML with resolved YouTube IDs) like so:

```sh
cd ../byom-sync
go build -o byom-sync .   # or: make build

# Export each playlist to its exact target path. `export jspf` on a *directory*
# names files "<base>.jspf", so export per-file to control the ".jspf.json" name.
OUT=../byom-player/public/playlists
for name in 20150907 bleep-bloop-bop-synthpop industrial-accident-industrial-ebm \
            some-of-my-90s-dance-bullshit sometimes-i-miss-city-club 2014-top-songs; do
  ./byom-sync export jspf --input "playlists/$name.yaml" --out "$OUT/$name.jspf.json"
done
```

The exporter is deterministic, so unchanged source YAML produces byte-identical
output — `git diff public/playlists/` shows only what actually changed. YouTube
IDs land at `track.extension["…byom-sync"][0].resolved.youtube`, which the
`youtube` provider reads to skip an on-demand lookup.

## Releasing

Tagged versions are published to npm as
[`@lmorchard/byom-player`](https://www.npmjs.com/package/@lmorchard/byom-player)
by `release.yml` using [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC — no stored token), with a provenance attestation. jsDelivr then serves
each version immutably at `…/npm/@lmorchard/byom-player@<version>/dist/byom-player.js`.

(`rolling-release.yml` still rebuilds the `dist` branch + `latest` prerelease on
every push to `main` for bleeding-edge use; tagged npm versions are the stable
channel.)

To cut a release:

```sh
# 1. Bump the version (updates package.json + lockfile; no git tag yet)
npm version <major|minor|patch> --no-git-tag-version

# 2. Update the version in the README "Usage" <script> example to match.

# 3. Commit, open a PR, merge to main.

# 4. Tag the merged commit and push — this triggers release.yml:
git tag vX.Y.Z origin/main
git push origin vX.Y.Z
```

`release.yml` runs CI, verifies the tag matches `package.json`'s version (fails
fast otherwise), builds, publishes to npm via OIDC, and cuts a GitHub release
with `byom-player.js` + `checksums.txt` attached.

Notes:

- **Trusted publisher** is configured once on npmjs.com (package Settings →
  Trusted Publishing → GitHub Actions: repo `lmorchard/byom-player`, workflow
  `release.yml`). No `NPM_TOKEN` secret needed.
- The package ships only `dist/*.js` (`files` in `package.json`) — the module
  plus its code-split chunk, not the demo playlists or harness assets.
- Provenance requires `package.json`'s `repository.url` to match this repo —
  don't remove it, or publish fails with `E422`.

## License

MIT — see [LICENSE](LICENSE).
