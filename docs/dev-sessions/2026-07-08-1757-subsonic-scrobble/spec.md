# Spec: Subsonic scrobble on play

## Goal

Record listening metrics on the Navidrome / Subsonic server by calling the
Subsonic `scrobble` API from `SubsonicProvider` as tracks play.

## Behavior

Two-phase scrobbling, matching the Last.fm / Navidrome convention:

1. **Now-playing** — on play start, send `scrobble` with `submission=false`
   once per loaded track. Updates the server's "now playing" state; does not
   count as a play.
2. **Submission** — send `scrobble` with `submission=true` once per track, when
   playback position first reaches **half the track duration OR 4 minutes
   (240 s), whichever is sooner**. This is the actual play-count increment.

Guards:

- Tracks shorter than **30 s** are never submitted (`submission=true` skipped).
  Now-playing may still fire for them.
- Each phase fires **at most once per loaded track**; `load()` resets the
  per-track flags.

## Endpoint

- Method: `scrobble` — built with the same URL/auth helpers as `search3` /
  `stream`, i.e. `GET /rest/scrobble.view?id=<songId>&submission=<bool>&time=<epochMs>&<auth>`.
- `.view` suffix is kept for consistency with the existing endpoints. Navidrome
  serves the method at both `/rest/scrobble` and `/rest/scrobble.view`; a code
  comment notes the bare alias.
- `time` is the client timestamp in epoch milliseconds (optional in the API but
  sent so the server records an accurate listen time).

## Reliability constraints

Scrobbling is **fire-and-forget** and must never disrupt playback:

- Does **not** go through the retrying `fetchJson` used for resolution.
- A failed or slow scrobble must **not** trip the circuit breaker, surface an
  `error` state, or block/await playback.
- Failures are swallowed and logged only under `debug`.

## Configuration

- Add `scrobble?: boolean` to `SubsonicConfig`, **default `true`**. When
  `false`, neither now-playing nor submission is sent.

## Design decisions / tradeoffs

- **Position-based threshold, not accumulated listen time.** The threshold is
  checked against the audio element's current position. Seeking past the
  halfway point therefore triggers submission early. Tracking true accumulated
  listen time is more code; position-based is the simpler, standard-enough
  choice for this feature and is explicitly accepted.
- Now-playing is hooked off the existing `playing` event; the submission
  threshold check is hooked off the existing `timeupdate` handler
  (`emitProgress`), so no new audio listeners are added.
- The resolved song `id` (already produced by `load()`) is stored as
  `currentId` for scrobble calls.

## Testing

Unit tests (fake `fetch` + existing test seams / `happy-dom`):

- Now-playing (`submission=false`) fires once on play start.
- Submission (`submission=true`) fires once when position crosses the threshold
  (half-duration for a short-ish track; 4 min cap for a long track).
- Submission never fires for tracks < 30 s.
- Neither call fires when `scrobble: false`.
- A rejected scrobble `fetch` does not change provider state or trip playback
  (no `error` emitted, `play()` still resolves).
- Correct query params on the scrobble URL (`id`, `submission`, auth present).

## Out of scope

- Accumulated-listen-time tracking (see tradeoff above).
- Scrobbling for other providers (mock, youtube, spotify).
- Server-side "now playing" UI in the component.
