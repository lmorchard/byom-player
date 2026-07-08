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
- Swappable providers: `mock` (no infra, for demos/dev) and `subsonic` (any
  Subsonic / OpenSubsonic server — Navidrome, gonic, Airsonic, LMS, …)
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

| Property         | Default  | Notes                                          |
| ---------------- | -------- | ---------------------------------------------- |
| `src`            | `''`     | URL to the JSPF manifest                       |
| `provider`       | `'mock'` | `'mock'` or `'subsonic'`                       |
| `providerConfig` | `{}`     | provider-specific config (JS property)         |
| `prescan`        | `true`   | background availability check after load       |
| `skipDelayMs`    | `400`    | throttle between auto-skips                    |
| `debug`          | `false`  | console diagnostics from provider + controller |

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
diagnostic.

## License

MIT — see [LICENSE](LICENSE).
