import { describe, it, expect } from 'vitest';
import {
  ALL_PROVIDERS,
  parseProviderList,
  parsePlaylistChildren,
  buildDeploymentConfig,
} from './hostConfig';

describe('parseProviderList', () => {
  it('defaults to all providers when null/empty', () => {
    expect(parseProviderList(null)).toEqual([...ALL_PROVIDERS]);
    expect(parseProviderList('')).toEqual([...ALL_PROVIDERS]);
  });

  it('parses a CSV allowlist, trimming and dropping unknowns', () => {
    expect(parseProviderList('youtube, subsonic , bogus')).toEqual(['youtube', 'subsonic']);
  });

  it('falls back to all when the CSV names no known providers', () => {
    expect(parseProviderList('bogus,nope')).toEqual([...ALL_PROVIDERS]);
  });
});

describe('parsePlaylistChildren', () => {
  it('reads title + src from <byom-playlist> children', () => {
    const host = document.createElement('div');
    host.innerHTML =
      '<byom-playlist title="Road Trip" src="/rt.json"></byom-playlist>' +
      '<byom-playlist title="Chill" src="/chill.json"></byom-playlist>';
    expect(parsePlaylistChildren(host)).toEqual([
      { title: 'Road Trip', src: '/rt.json' },
      { title: 'Chill', src: '/chill.json' },
    ]);
  });

  it('ignores children missing src', () => {
    const host = document.createElement('div');
    host.innerHTML = '<byom-playlist title="No src"></byom-playlist>';
    expect(parsePlaylistChildren(host)).toEqual([]);
  });

  it('returns [] when there are no playlist children', () => {
    expect(parsePlaylistChildren(document.createElement('div'))).toEqual([]);
  });
});

describe('buildDeploymentConfig', () => {
  it('maps spotify + youtube attributes into per-provider config', () => {
    const dep = buildDeploymentConfig(
      {
        spotifyClientId: 'cid',
        spotifyRedirectUri: 'https://x/cb',
        youtubeApiKey: 'yk',
        youtubeSearchEndpoint: 'https://x/yt',
      },
      {},
      'mock',
    );
    expect(dep.spotify).toEqual({ clientId: 'cid', redirectUri: 'https://x/cb' });
    expect(dep.youtube).toEqual({ apiKey: 'yk', searchEndpoint: 'https://x/yt' });
  });

  it('folds the flat providerConfig escape hatch into the initial provider', () => {
    const dep = buildDeploymentConfig({}, { baseUrl: 'https://nav' }, 'subsonic');
    expect(dep.subsonic).toEqual({ baseUrl: 'https://nav' });
  });

  it('lets spotify attributes override the folded providerConfig', () => {
    const dep = buildDeploymentConfig(
      { spotifyClientId: 'attr-cid' },
      { clientId: 'legacy' },
      'spotify',
    );
    expect(dep.spotify.clientId).toBe('attr-cid');
  });
});
