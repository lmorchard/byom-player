import { describe, it, expect } from 'vitest';
import { loadManifest, BYOM_EXT_NS } from './manifest';

const jspf = {
  playlist: {
    title: 'Road Trip',
    creator: 'Les',
    date: '2026-07-08T00:00:00Z',
    track: [
      {
        title: 'Nightcall',
        creator: 'Kavinsky',
        album: 'OutRun',
        duration: 258,
        identifier: ['urn:isrc:FR0W61200001'],
        location: ['https://open.spotify.com/track/abc'],
      },
      {
        title: 'No ISRC Track',
        creator: 'Someone',
      },
    ],
  },
};

describe('loadManifest', () => {
  it('maps JSPF playlist metadata', () => {
    const pl = loadManifest(jspf);
    expect(pl.title).toBe('Road Trip');
    expect(pl.creator).toBe('Les');
    expect(pl.dateCreated).toBe('2026-07-08T00:00:00Z');
    expect(pl.tracks).toHaveLength(2);
  });

  it('maps JSPF track fields into the internal model', () => {
    const t = loadManifest(jspf).tracks[0];
    expect(t.title).toBe('Nightcall');
    expect(t.artist).toBe('Kavinsky'); // creator -> artist
    expect(t.album).toBe('OutRun');
    expect(t.isrc).toBe('FR0W61200001'); // urn:isrc: stripped
    expect(t.durationMs).toBe(258000); // seconds -> ms
    expect(t.spotifyUrl).toBe('https://open.spotify.com/track/abc'); // location[0]
  });

  it('leaves optional fields undefined when absent', () => {
    const t = loadManifest(jspf).tracks[1];
    expect(t.isrc).toBeUndefined();
    expect(t.durationMs).toBeUndefined();
    expect(t.spotifyUrl).toBeUndefined();
    expect(t.syncState).toBeUndefined();
  });

  it('reads sync_state from the byom-sync JSPF extension', () => {
    const withExt = {
      playlist: {
        title: 'X',
        track: [
          {
            title: 'Orphaned',
            creator: 'A',
            extension: {
              [BYOM_EXT_NS]: [{ spotify_present: false, date_orphaned: '2026-06-01T00:00:00Z' }],
            },
          },
        ],
      },
    };
    const t = loadManifest(withExt).tracks[0];
    expect(t.syncState).toEqual({ spotifyPresent: false, dateOrphaned: '2026-06-01T00:00:00Z' });
  });

  it('reads resolved.youtube from the extension into resolvedIds', () => {
    const withResolved = {
      playlist: {
        track: [
          {
            title: 'A',
            creator: 'B',
            extension: { [BYOM_EXT_NS]: [{ resolved: { youtube: 'vidX' } }] },
          },
          { title: 'C', creator: 'D' }, // no extension
          { title: 'E', creator: 'F', extension: { [BYOM_EXT_NS]: [{ resolved: 'nope' }] } }, // malformed
          {
            title: 'G',
            creator: 'H',
            extension: { [BYOM_EXT_NS]: [{ resolved: { youtube: 123 } }] },
          }, // non-string
        ],
      },
    };
    const tracks = loadManifest(withResolved).tracks;
    expect(tracks[0].resolvedIds).toEqual({ youtube: 'vidX' });
    expect(tracks[1].resolvedIds).toBeUndefined();
    expect(tracks[2].resolvedIds).toBeUndefined();
    expect(tracks[3].resolvedIds).toBeUndefined();
  });

  it('unwraps an already-unwrapped playlist object', () => {
    const pl = loadManifest({ title: 'Flat', track: [] });
    expect(pl.title).toBe('Flat');
    expect(pl.tracks).toEqual([]);
  });

  it('handles an empty/missing track list', () => {
    expect(loadManifest({ playlist: { title: 'Empty' } }).tracks).toEqual([]);
  });
});
