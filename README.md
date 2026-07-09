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

Load the latest build via jsDelivr (rebuilt on every push to `main`), self-host
the downloadable release asset, or build it yourself (see Development):

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/lmorchard/byom-player@dist/byom-player.js"
></script>

<byom-player src="/playlists/road-trip.jspf.json" provider="subsonic"></byom-player>
```

> jsDelivr serves the module from the `dist` branch with the correct MIME type
> and CORS headers. The GitHub release asset (`…/releases/download/latest/…`) is
> a download for self-hosting — it can't be used directly in a `<script>` tag
> (served as `application/octet-stream`). npm publishing is planned once the
> component matures.

Provider config (e.g. Subsonic credentials) is set as a JS property:

```js
const player = document.querySelector('byom-player');
player.providerConfig = {
  baseUrl: 'https://music.example.com',
  username: 'you',
  password: 'secret', // converted to a salted token in-browser; never sent as plaintext
  // or: apiKey: '...'  (OpenSubsonic)
};
```

### Properties

| Property         | Default  | Notes                                                      |
| ---------------- | -------- | ---------------------------------------------------------- |
| `src`            | `''`     | URL to the JSPF manifest                                   |
| `provider`       | `'mock'` | `'mock'`, `'subsonic'`, `'youtube'`, `'spotify'`, `'plex'` |
| `providerConfig` | `{}`     | provider-specific config (JS property)                     |
| `prescan`        | `true`   | background availability check after load                   |
| `skipDelayMs`    | `400`    | throttle between auto-skips                                |
| `debug`          | `false`  | console diagnostics from provider + controller             |

### Theming

```css
byom-player {
  --byom-bg: #1e1e1e;
  --byom-text: #ffffff;
  --byom-accent: #ff0055;
  --byom-font: system-ui, sans-serif;
  --byom-border-radius: 8px;
}
```

## Manifest

Standard JSPF. `sync_state` (orphaned-track info from byom-sync) is read from a
JSPF track `extension` when present and ignored otherwise, so generic JSPF works.

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

## License

MIT — see [LICENSE](LICENSE).
