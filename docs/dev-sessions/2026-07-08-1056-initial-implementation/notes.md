# Notes — byom-player initial implementation

## Status: functional, live-verified against Navidrome; visual polish deferred

`<byom-player>` is a working Lit web component that loads a JSPF playlist and
plays it through swappable audio providers. Built and hardened across one long
interactive session, verified end-to-end against a real Navidrome instance.
57 tests + lint + build green.

## What was built (Phases 1–4 of plan.md, all done)

- **Phase 1** — Vite (lib mode) + Lit + TS + Vitest/happy-dom + ESLint/Prettier
  scaffold; internal `types.ts`; generic JSPF `loadManifest` (maps JSPF → clean
  Track model, reads `sync_state` from a byom-sync JSPF extension).
- **Phase 2** — `AudioProvider` interface, timer-driven `MockProvider`,
  `PlaybackController` (queue, advance-on-ended, skip-on-error).
- **Phase 3** — `<byom-player>` element: props/state, fetch-on-connect, controls,
  active/orphan/unavailable classes; `providerFactory` injection seam.
- **Phase 4** — `SubsonicProvider` (was DirectProvider): resolve via Subsonic
  `search3` → `stream`; HTML5 Audio; unit-tested URL/auth/state mapping.

## Post-plan hardening + features (added live, beyond the original 5 phases)

Discovered/requested during real Navidrome testing:

- **Teardown**: `disconnectedCallback` disposes the provider (AbortController
  listeners, audio.pause + src cleared) — no audio outliving a removed element.
- **First-press play**: `play()` loads the current track if nothing loaded yet.
- **Error tolerance**: distinguish `unavailable` (clean miss — skip freely) from
  `error` (transient — retried with backoff). Circuit breaker halts auto-skip
  after N consecutive errors so a flaky/rate-limiting server isn't hammered.
  Stale unavailable marks clear when a track later plays. Skip throttling.
- **Background prescan**: optional `checkAvailability` + gentle sequential
  `sweepAvailability`; component marks tracks proactively; queue (shuffle/advance)
  skips known-unavailable; three UI states (pending / available / unavailable).
- **Shuffle**: controller order/pos model (identity or shuffled, current track
  preserved), skips known-unavailable, On/Off indicator.
- **Provider rename** `direct` → `subsonic` (generic Subsonic/OpenSubsonic — core
  endpoints only; `direct` kept as a deprecated alias). Works with Navidrome,
  gonic, Airsonic, LMS, etc.
- **Auth**: vendored MD5 (`src/md5.ts`, RFC-vector + UTF-8 verified); username +
  password derive a random-salted token client-side, so the plaintext password
  never goes on the wire. `apiKey` (OpenSubsonic) and token+salt also supported.

## Manifest contract (recap from research.md)

Player consumes **standard JSPF**. `sync_state` (orphan info) rides in a JSPF
track `extension` under `BYOM_EXT_NS`. byom-sync doesn't emit that extension yet
— see dependency below.

## Dev harness (`index.html`, dev-only)

Preset dropdown (test playlists), provider + Subsonic auth (username/password or
apiKey), a "🎲 Play random from Navidrome" diagnostic (builds a synthetic
manifest from `getRandomSongs` so playback can be tested with guaranteed hits).
Config saved to localStorage only. Test manifests live in gitignored
`public/playlists/`.

## Deferred / follow-ups

- **Phase 5 — visual polish** (UI prototype → port): NOT done. Current UI is
  functional-but-plain by design. This is the one planned phase remaining.
- **byom-sync JSPF `sync_state` extension**: small PR in the byom-sync repo so
  the orphan indicator has real data end-to-end (player already reads it).
- **YouTube provider**: fast-follow (public-visitor path; needs a search backend).
- **Navidrome cookie warning** in console is harmless (we auth via query params,
  not cookies).
