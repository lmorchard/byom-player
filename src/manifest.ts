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
  image?: string;
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
    dateUpdated: readPlaylistDateUpdated(pl.extension),
    annotation: pl.annotation,
    image: pl.image,
    tracks: tracks.map(mapTrack),
  };
}

// readPlaylistDateUpdated pulls the playlist-level `date_updated` from the
// byom-sync extension (JSPF's standard `date` carries date_created only).
function readPlaylistDateUpdated(extension?: Record<string, unknown[]>): string | undefined {
  const body = extension?.[BYOM_EXT_NS]?.[0] as any;
  return typeof body?.date_updated === 'string' ? body.date_updated : undefined;
}

function mapTrack(t: JspfTrack): Track {
  return {
    title: t.title ?? '',
    artist: t.creator ?? '',
    album: t.album,
    isrc: parseIsrc(t.identifier),
    byomId: parseByomId(t.identifier),
    image: t.image,
    durationMs: typeof t.duration === 'number' ? t.duration * 1000 : undefined,
    spotifyUrl: t.location?.[0],
    syncState: readSyncState(t.extension),
    resolvedIds: readResolved(t.extension),
  };
}

// readResolved pulls pre-resolved provider ids from the byom-sync extension
// (currently just YouTube). Accepts only a string id; anything else is ignored.
function readResolved(extension?: Record<string, unknown[]>): { youtube?: string } | undefined {
  const body = extension?.[BYOM_EXT_NS]?.[0] as any;
  const resolved = body?.resolved;
  if (!resolved || typeof resolved !== 'object') return undefined;
  const youtube = typeof resolved.youtube === 'string' ? resolved.youtube : undefined;
  return youtube ? { youtube } : undefined;
}

function parseIsrc(identifiers?: string[]): string | undefined {
  for (const id of identifiers ?? []) {
    const m = /^urn:isrc:(.+)$/i.exec(id);
    if (m) return m[1];
  }
  return undefined;
}

// parseByomId pulls byom-sync's synthesized content id from a "urn:byom:<hash>"
// identifier. byom-sync emits it for tracks with no ISRC so they stay stably
// addressable; the resolution cache keys on it.
function parseByomId(identifiers?: string[]): string | undefined {
  for (const id of identifiers ?? []) {
    const m = /^urn:byom:(.+)$/i.exec(id);
    if (m) return m[1];
  }
  return undefined;
}

function readSyncState(extension?: Record<string, unknown[]>): SyncState | undefined {
  const body = extension?.[BYOM_EXT_NS]?.[0] as any;
  if (!body || typeof body !== 'object') return undefined;
  // byom-sync emits sync_state only for orphaned tracks, so an element without a
  // `spotify_present` key (e.g. a resolved-only present track) carries no sync
  // signal. Distinguish that from an explicit `false`, which means orphaned.
  if (!('spotify_present' in body)) return undefined;
  return {
    spotifyPresent: Boolean(body.spotify_present),
    dateOrphaned: body.date_orphaned || undefined,
  };
}
