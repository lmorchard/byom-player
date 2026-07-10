// Internal data model used by the UI. The manifest loader adapts external JSPF
// into these shapes so the component never deals with JSPF quirks directly.

export interface SyncState {
  spotifyPresent: boolean;
  dateOrphaned?: string;
}

export interface Track {
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
  // Stable byom-sync content id (from a JSPF `urn:byom:<hash>` identifier),
  // present on tracks without an ISRC. Used as the resolution-cache key so
  // off-Spotify tracks get a stable, album-aware identity.
  byomId?: string;
  durationMs?: number;
  spotifyUrl?: string;
  syncState?: SyncState;
  // Provider ids resolved ahead of time (by byom-sync) and carried in the
  // manifest extension, so the player can skip an on-demand lookup.
  resolvedIds?: { youtube?: string };
}

export interface Playlist {
  title: string;
  creator?: string;
  dateCreated?: string;
  // Host-authored markdown blurb (the playlist's "story"), from JSPF `annotation`.
  annotation?: string;
  tracks: Track[];
}
