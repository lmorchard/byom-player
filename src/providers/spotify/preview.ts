// Spotify's iframe embed forces a 30-second *preview* when playback is started
// programmatically (controller.play()/resume()) — a documented Spotify IFrame
// API bug — even for logged-in Premium viewers; a full track only plays when the
// viewer clicks the embed's own ▶. We can't puppet full playback (cross-origin
// iframe), so instead we detect the preview state and let the UI guide the
// viewer. See byom-player#31.
//
// Heuristic: the embed reports a ~30s duration while the manifest says the track
// is meaningfully longer. Guarded so a genuinely short track (or an unknown
// manifest duration) never trips it, and only meaningful for the Spotify
// provider (other providers never truncate to a preview).

// Spotify previews are ~30s; allow a little slack above 30,000ms.
export const PREVIEW_MAX_MS = 31_000;
// The manifest must exceed the embed duration by at least this much before we
// call it a preview — keeps a real ~30s track from being flagged.
export const PREVIEW_MARGIN_MS = 5_000;

export function detectSpotifyPreview(provider: string, embedMs: number, trackMs: number): boolean {
  if (provider !== 'spotify') return false;
  return embedMs > 0 && embedMs <= PREVIEW_MAX_MS && trackMs > embedMs + PREVIEW_MARGIN_MS;
}
