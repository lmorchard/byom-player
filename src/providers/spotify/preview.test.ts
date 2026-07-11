import { describe, it, expect } from 'vitest';
import { detectSpotifyPreview } from './preview';

describe('detectSpotifyPreview', () => {
  it('flags a ~30s embed duration against a longer manifest track', () => {
    expect(detectSpotifyPreview('spotify', 30_000, 258_000)).toBe(true);
    expect(detectSpotifyPreview('spotify', 29_000, 258_000)).toBe(true);
  });

  it('does not flag when the embed duration matches the manifest (full track)', () => {
    expect(detectSpotifyPreview('spotify', 258_000, 258_000)).toBe(false);
  });

  it('does not flag a genuinely short (~30s) track', () => {
    // manifest ~= embed, within the margin → not a preview
    expect(detectSpotifyPreview('spotify', 30_000, 33_000)).toBe(false);
  });

  it('does not flag when the manifest duration is unknown (0)', () => {
    expect(detectSpotifyPreview('spotify', 30_000, 0)).toBe(false);
  });

  it('does not flag before any duration is known', () => {
    expect(detectSpotifyPreview('spotify', 0, 258_000)).toBe(false);
  });

  it('only applies to the spotify provider', () => {
    expect(detectSpotifyPreview('subsonic', 30_000, 258_000)).toBe(false);
    expect(detectSpotifyPreview('youtube', 30_000, 258_000)).toBe(false);
    expect(detectSpotifyPreview('mock', 30_000, 258_000)).toBe(false);
  });
});
