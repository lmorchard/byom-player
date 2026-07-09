# Notes: Subsonic scrobble on play

## Summary

Added two-phase Subsonic/Navidrome scrobbling to `SubsonicProvider`, driven off
its existing HTML audio events — no new listeners.

- **Now-playing** (`submission=false`) fires off the `playing` event, once per
  loaded track.
- **Submission** (`submission=true`) fires from the existing `emitProgress`
  (`timeupdate`) handler, once, when playback position first reaches
  `min(duration/2, 240s)`. Tracks under 30 s never submit.
- **Fire-and-forget**: a bare `fetch(url).catch(log)` — never awaited, never
  routed through the retrying `fetchJson`, never touches provider state. A
  flaky scrobble can't disrupt playback or trip the circuit breaker.
- Gated by new `SubsonicConfig.scrobble` flag (default `true`).
- Endpoint: `/rest/scrobble.view` via the existing `url()` auth helper
  (Navidrome also accepts the bare `/rest/scrobble` alias).

## Status

- Unit tests: 8 new (20 in the provider suite, 78 total). Lint + build clean.
- **Live verification against Navidrome: not yet done.** Unit tests mock
  `fetch`; a real server hit is still pending (see below).

## Key decisions

- Threshold is checked against playback **position**, not accumulated listen
  time (accepted tradeoff — seeking past halfway triggers submission early).
- Unknown duration (`0`) is treated as "too short" → no submission. Navidrome
  files report duration, so this is fine in practice.

## Gotchas hit

- **happy-dom `audio.duration` is read-only** via direct assignment (yields
  `NaN`). Tests must use `Object.defineProperty(audio, 'duration', {value, configurable: true})`.
  `currentTime` sets directly.
- Wrote the spec/plan with the **main-checkout absolute path** by mistake while
  in the worktree — dropped a stray `spec.md` into the other agent's checkout.
  Moved it into the worktree and cleaned up. Lesson: file tools take absolute
  paths; use the worktree path, not the main checkout's.

## Environment

- Worktree: `.claude/worktrees/subsonic-scrobble`, branch
  `worktree-subsonic-scrobble` (branched fresh from `origin/main`).
- Dev server: worktree vite on **:5174** (:5173 was the other agent's main
  checkout — no collision).

## Live verification checklist (pending)

With `npm run dev` + Navidrome creds in the harness:
- Play → `GET /rest/scrobble.view?...submission=false` on start.
- Pass halfway → one `submission=true` request.
- Navidrome UI play count / recently-played updates.
- Skip before threshold → no `submission=true`.
