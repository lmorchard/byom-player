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
  durationMs?: number;
  spotifyUrl?: string;
  syncState?: SyncState;
}

export interface Playlist {
  title: string;
  creator?: string;
  dateCreated?: string;
  tracks: Track[];
}
