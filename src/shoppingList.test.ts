import { describe, it, expect } from 'vitest';
import { buildShoppingList, toMarkdown, searchUrlFor } from './shoppingList';
import type { Track } from './types';
import type { AvailabilityStatus } from './providers/types';

const t = (title: string, artist: string, album?: string, purchaseUrl?: string): Track => ({
  title,
  artist,
  album,
  purchaseUrl,
});

// Build a status map from a terse array, so tests read as data.
const statuses = (...xs: (AvailabilityStatus | undefined)[]) => {
  const m = new Map<number, AvailabilityStatus>();
  xs.forEach((s, i) => s && m.set(i, s));
  return m;
};

describe('buildShoppingList', () => {
  it('groups missing tracks by artist and album', () => {
    const tracks = [
      t('Superstar', 'Beach House', 'Once Twice Melody'),
      t('Pink Funeral', 'Beach House', 'Once Twice Melody'),
      t('Myth', 'Beach House', 'Bloom'),
    ];
    const list = buildShoppingList(tracks, statuses('unavailable', 'unavailable', 'unavailable'));
    expect(list.albums).toHaveLength(2);
    expect(list.albums[0]).toMatchObject({ album: 'Once Twice Melody' });
    expect(list.albums[0].tracks.map((x) => x.title)).toEqual(['Superstar', 'Pink Funeral']);
    expect(list.missingCount).toBe(3);
  });

  it('only lists tracks the collection reported as missing', () => {
    const tracks = [t('A', 'X', 'Alb'), t('B', 'X', 'Alb'), t('C', 'X', 'Alb')];
    const list = buildShoppingList(tracks, statuses('available', 'unavailable', undefined));
    expect(list.missingCount).toBe(1);
    expect(list.albums[0].tracks.map((x) => x.title)).toEqual(['B']);
  });

  // The point of the tri-state. A transient failure must not become "go buy
  // this" — you may already own it and the server merely hiccuped.
  it('never lists an unknown, but does count it', () => {
    const tracks = [t('A', 'X', 'Alb'), t('B', 'X', 'Alb')];
    const list = buildShoppingList(tracks, statuses('unknown', 'unavailable'));
    expect(list.uncheckedCount).toBe(1);
    expect(list.missingCount).toBe(1);
    expect(list.albums.flatMap((a) => a.tracks).map((x) => x.title)).toEqual(['B']);
  });

  it('orders albums by how many tracks are missing', () => {
    const tracks = [
      t('one', 'Solo', 'Single Album'),
      t('a', 'Band', 'Big Album'),
      t('b', 'Band', 'Big Album'),
      t('c', 'Band', 'Big Album'),
    ];
    const list = buildShoppingList(
      tracks,
      statuses('unavailable', 'unavailable', 'unavailable', 'unavailable'),
    );
    expect(list.albums.map((a) => a.album)).toEqual(['Big Album', 'Single Album']);
  });

  it('keeps playlist order within an album', () => {
    const tracks = [t('third', 'X', 'A'), t('first', 'X', 'A'), t('second', 'X', 'A')];
    const list = buildShoppingList(tracks, statuses('unavailable', 'unavailable', 'unavailable'));
    expect(list.albums[0].tracks.map((x) => x.title)).toEqual(['third', 'first', 'second']);
  });

  it('collapses albumless tracks into one bucket per artist, sorted last', () => {
    const tracks = [
      t('loose one', 'X'),
      t('loose two', 'X'),
      t('on an album', 'X', 'Real Album'),
      t('also on it', 'X', 'Real Album'),
    ];
    const list = buildShoppingList(
      tracks,
      statuses('unavailable', 'unavailable', 'unavailable', 'unavailable'),
    );
    expect(list.albums).toHaveLength(2);
    // Equal counts, so the tiebreak puts the albumless bucket after the album.
    expect(list.albums[0].album).toBe('Real Album');
    expect(list.albums[1].album).toBeUndefined();
    expect(list.albums[1].tracks).toHaveLength(2);
  });

  it('takes the album purchase link from whichever track carries it', () => {
    const tracks = [t('a', 'X', 'Alb'), t('b', 'X', 'Alb', 'https://x.bandcamp.com/album/alb')];
    const list = buildShoppingList(tracks, statuses('unavailable', 'unavailable'));
    expect(list.albums[0].purchaseUrl).toBe('https://x.bandcamp.com/album/alb');
  });

  it('groups case- and whitespace-variant metadata together', () => {
    const tracks = [t('a', 'Beach House', 'Bloom'), t('b', 'beach house ', ' BLOOM')];
    const list = buildShoppingList(tracks, statuses('unavailable', 'unavailable'));
    expect(list.albums).toHaveLength(1);
  });

  it('is stable and empty for a fully available playlist', () => {
    const list = buildShoppingList([t('a', 'X', 'A')], statuses('available'));
    expect(list.albums).toEqual([]);
    expect(list.missingCount).toBe(0);
    expect(list.uncheckedCount).toBe(0);
  });

  it('handles an unscanned playlist without inventing rows', () => {
    const list = buildShoppingList([t('a', 'X', 'A'), t('b', 'Y', 'B')], new Map());
    expect(list.albums).toEqual([]);
    expect(list.missingCount).toBe(0);
  });
});

describe('searchUrlFor', () => {
  it('builds a Bandcamp search so a row is never a dead end', () => {
    const u = searchUrlFor({ artist: 'Beach House', album: 'Bloom', tracks: [] });
    expect(u).toContain('bandcamp.com/search');
    expect(u).toContain(encodeURIComponent('Beach House Bloom'));
  });

  it('copes with an albumless group', () => {
    expect(searchUrlFor({ artist: 'X', tracks: [] })).toContain(encodeURIComponent('X'));
  });
});

describe('toMarkdown', () => {
  it('renders albums with links and their missing tracks', () => {
    const list = buildShoppingList(
      [
        t(
          'Superstar',
          'Beach House',
          'Once Twice Melody',
          'https://beachhouse.bandcamp.com/album/otm',
        ),
        t('Pink Funeral', 'Beach House', 'Once Twice Melody'),
      ],
      statuses('unavailable', 'unavailable'),
    );
    const md = toMarkdown(list, 'My Mixtape');
    expect(md).toContain('# Missing from my collection — My Mixtape');
    expect(md).toContain(
      '## [Beach House — Once Twice Melody](https://beachhouse.bandcamp.com/album/otm)',
    );
    expect(md).toContain('- Superstar');
    expect(md).toContain('- Pink Funeral');
    expect(md).toContain('2 track(s) missing');
  });

  it('falls back to a search URL when no store resolved a link', () => {
    const list = buildShoppingList([t('a', 'Obscure Band', 'Rare LP')], statuses('unavailable'));
    expect(toMarkdown(list, 'PL')).toContain('bandcamp.com/search');
  });

  it('reports unchecked tracks so the list is not read as complete', () => {
    const list = buildShoppingList(
      [t('a', 'X', 'A'), t('b', 'Y', 'B')],
      statuses('unavailable', 'unknown'),
    );
    expect(toMarkdown(list, 'PL')).toContain('1 could not be checked');
  });

  it('says so plainly when nothing is missing', () => {
    expect(toMarkdown(buildShoppingList([], new Map()), 'PL')).toContain('Nothing missing.');
  });
});
