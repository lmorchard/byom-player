# Notes: Spotify provider

## Outcome

Implemented the `spotify` audio provider end-to-end across 8 TDD tasks. All
`npm run lint && npm test && npm run build` green (92 tests). Verified the dev
harness in a real browser (Playwright): selecting the Spotify provider reveals
its config fieldset, the player mounts, and the provider renders its "Connect
Spotify" button from the `attach` surface (the no-token path) with zero console
errors.

## What shipped

- `src/providers/spotify/` — `types.ts`, `pkce.ts`, `auth.ts`,
  `SpotifyProvider.ts`, `WebPlaybackEngine.ts` (SDK/Premium, browser-only),
  `EmbedEngine.ts` (iframe/free, browser-only), plus `*.test.ts`.
- `registry.ts` — `case 'spotify'` (+ `registry.test.ts`).
- `index.html` — Spotify option/fieldset; `public/callback.html` — static PKCE
  landing page.
- `README.md` / `AGENTS.md` — provider docs incl. the static-hosting story.

## Design recap (as approved)

- **Tiered:** Web Playback SDK (Premium, full tracks, headless) with an
  automatic embed-iframe fallback (free = 30s previews, visible chrome). Tier is
  chosen in `initialize()`; `NotPremiumError` from the SDK triggers the fallback.
- **Provider-owned PKCE**, popup flow, **fully static / no backend** (public
  `client_id`, direct CORS token fetch, static `callback.html`).
- Resolution reads `track.spotifyUrl` (manifest maps JSPF `location` →
  `spotifyUrl`), so `checkAvailability` is a free network-less parse.

## Small deviations from the plan

- `EmbedEngine` constructor takes no args (the plan passed `cfg`, but it was
  unused → `tsc noUnusedParameters` failed). Dropped it; `makeEngine` calls
  `new EmbedEngine()`.
- Task 3 and Task 4 tests live in one file and were committed together as one
  coherent green commit (rather than a red Task-3 commit).
- Fixed a test-data bug: the "cached token unexpired" case needed `expiresAt`
  beyond the 60s refresh skew.

## Manual testing still required (needs real Spotify app + accounts)

Not automatable here — flagged for a follow-up manual pass:

1. Register a Spotify app; add `http://localhost:5173/callback.html` (or the
   dev origin shown) as a Redirect URI; put the Client ID in the harness.
2. **Premium:** click "Connect Spotify", authenticate in the popup, confirm
   full-track playback + seek + auto-advance through the queue.
3. **Free:** confirm the embed appears and previews play with byom-player's
   controls in sync.
4. **Known risk to watch:** embed-tier auto-advance may hit browser autoplay
   gating after the first gesture.

## Follow-ups / ideas (not done)

- Consider surfacing a "Premium required / preview only" hint in the UI when the
  embed tier is active (preview-vs-full isn't cleanly detectable — only
  inferable from a ~30s duration).
- Phase-5 visual design (issue #1) will want to style `.byom-spotify-connect`
  and the embed surface intentionally.
