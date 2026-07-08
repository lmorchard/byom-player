# Research — byom-player

Greenfield repo. Research targets: (1) the real manifest shape byom-sync emits
(the contract the player consumes), and (2) Lit + Vite web-component conventions.

## 1. Manifest contract — byom-sync output vs the spec's Track type

### What byom-sync's JSPF exporter actually emits (real sample)
```json
{
  "playlist": {
    "title": "Covered: Living on the Ceiling",
    "creator": "Les Orchard",
    "date": "2026-07-08T07:05:24Z",
    "track": [
      {
        "title": "Living on the Ceiling - Saturday Night Version",
        "creator": "Skinnerbox",
        "album": "Living on the Ceiling",
        "duration": 491,
        "identifier": ["urn:isrc:GB4PD0900195"],
        "location": ["https://open.spotify.com/track/4hSJhXB1nkMUwZEVagsTYA"]
      }
    ]
  }
}
```

### byom-sync's hub YAML (per playlist file) — the RICHER source
Fields: `spotify_id`, `title`, `creator`, `description`, `date_created`, and
`tracks[]` each with: `title`, `artist`, `album`, `isrc`, `spotify_id`,
`spotify_url`, `duration_ms`, `added_at`, `sync_state{spotify_present, date_orphaned}`.

### The gap (KEY for the spec)
The player spec's `Track` (`title, artist, isrc, duration_ms, sync_state`) matches
the **hub**, NOT the JSPF output. Concretely:

| player spec Track | JSPF output | hub YAML |
|---|---|---|
| flat `{title, creator, tracks}` | nested `{playlist:{…, track}}` | flat `{title, creator, tracks}` |
| `artist` | `creator` (per track) | `artist` |
| `isrc` (string) | `identifier: ["urn:isrc:X"]` | `isrc` |
| `duration_ms` | `duration` (seconds) | `duration_ms` |
| `tracks` | `track` | `tracks` |
| `sync_state` | **absent** | `sync_state` present |

The JSPF exporter DROPS `sync_state`, so the player's orphan-indicator UI cannot
be fed by today's JSPF. The hub carries everything the player needs (incl.
`spotify_url`, `added_at`). Implication: the player wants a hub-shaped JSON
manifest, which byom-sync does not yet emit (it has m3u8/jspf/markdown spokes,
no plain JSON dump). → likely a new `byom-sync export json` spoke.

## 2. Provider resolution reality (both need external infra)

- **YouTube IFrame provider:** playback is easy (IFrame Player API, hidden
  iframe, cue `videoId`). The hard part is RESOLUTION: turning "artist title" →
  `videoId` requires either the YouTube Data API (API key + quota, and key can't
  be safely embedded in a public static-site bundle) or a configured backend
  search endpoint. No videoId in the manifest today.
- **Direct/Navidrome provider:** playback via `new Audio()` is easy. RESOLUTION
  (ISRC/metadata → streamable URL) requires a Navidrome/Subsonic backend the
  browser can reach (auth, CORS). Not available to public visitors.

Neither provider is "just works" without a resolution layer. A `location`
(spotify_url) is NOT a playable audio stream. → provider scope for v1 needs a
decision; consider a resolver-endpoint abstraction and/or a stub/mock provider
for developing the UI + state machine without real audio infra.

## 3. Lit + Vite + TS web-component conventions

- **Lit:** `LitElement`, `@customElement('byom-player')`, `@property()` for
  attributes (`src`, `provider`), `@state()` for internal reactive state,
  `static styles = css\`…\``, `render()` returns `html\`…\``. Shadow DOM by
  default (style encapsulation + CSS-var theming via `:host`).
- **Vite library mode:** `build.lib = { entry, formats: ['es'], fileName }`
  produces a single ES module for dropping into static sites/Hugo. `vite` dev
  server for the demo/prototype page.
- **TypeScript:** `tsconfig` with `experimentalDecorators` + `useDefineForClass
  Fields: false` (Lit decorator requirement), `moduleResolution: bundler`.
- **Testing options:** `@web/test-runner` + `@open-wc/testing` (real browser,
  Lit-idiomatic) OR Vitest + `happy-dom`/`jsdom`. Web Test Runner is the
  Lit-community default for real-DOM component tests.
- **Lint/format:** ESLint + Prettier (TS). No Makefile convention here; the
  project defines npm scripts (`build`, `test`, `lint`, `dev`).

## Implications for the spec (to resolve in Q&A)
1. Manifest format: new hub-shaped `export json` in byom-sync (cross-repo) vs
   consume existing JSPF (lose sync_state) vs extend JSPF.
2. Provider scope for v1 given both need resolution infra; stub/mock provider
   for UI dev.
3. Feel-driven UI → interactive-prototype phase; spec the architecture tightly.
4. Test tooling choice (Web Test Runner vs Vitest).
