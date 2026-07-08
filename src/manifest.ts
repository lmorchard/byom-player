import type { Playlist, Track, SyncState } from './types';

// JSPF `extension` namespace under which byom-sync carries per-track sync_state.
// The player reads it when present and degrades gracefully for generic JSPF.
export const BYOM_EXT_NS = 'https://github.com/lmorchard/byom-sync';

interface JspfTrack {
  title?: string;
  creator?: string;
  album?: string;
  duration?: number;
  identifier?: string[];
  location?: string[];
  extension?: Record<string, unknown[]>;
}

// loadManifest normalizes a parsed JSPF document (or an already-unwrapped
// playlist object) into the internal Playlist model.
export function loadManifest(json: unknown): Playlist {
  const root = json as any;
  const pl = root?.playlist ?? root ?? {};
  const tracks: JspfTrack[] = pl.track ?? pl.tracks ?? [];
  return {
    title: pl.title ?? '',
    creator: pl.creator,
    dateCreated: pl.date ?? pl.date_created,
    tracks: tracks.map(mapTrack),
  };
}

function mapTrack(t: JspfTrack): Track {
  return {
    title: t.title ?? '',
    artist: t.creator ?? '',
    album: t.album,
    isrc: parseIsrc(t.identifier),
    durationMs: typeof t.duration === 'number' ? t.duration * 1000 : undefined,
    spotifyUrl: t.location?.[0],
    syncState: readSyncState(t.extension),
  };
}

function parseIsrc(identifiers?: string[]): string | undefined {
  for (const id of identifiers ?? []) {
    const m = /^urn:isrc:(.+)$/i.exec(id);
    if (m) return m[1];
  }
  return undefined;
}

function readSyncState(extension?: Record<string, unknown[]>): SyncState | undefined {
  const body = extension?.[BYOM_EXT_NS]?.[0] as any;
  if (!body || typeof body !== 'object') return undefined;
  return {
    spotifyPresent: Boolean(body.spotify_present),
    dateOrphaned: body.date_orphaned || undefined,
  };
}
