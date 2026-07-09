import type { AudioProvider } from './types';
import { MockProvider } from './MockProvider';
import { SubsonicProvider } from './SubsonicProvider';
import { YouTubeProvider } from './YouTubeProvider';
import { SpotifyProvider } from './spotify/SpotifyProvider';
import { PlexProvider } from './plex/PlexProvider';

// createProvider maps a provider name (+ config) to an AudioProvider instance.
// Unknown names are an error.
export function createProvider(name: string, config: Record<string, unknown>): AudioProvider {
  switch (name) {
    case 'mock':
      return new MockProvider();
    case 'subsonic':
    case 'direct': // deprecated alias for 'subsonic'
      return new SubsonicProvider(config);
    case 'youtube':
      return new YouTubeProvider(config);
    case 'spotify':
      return new SpotifyProvider(config);
    case 'plex':
      return new PlexProvider(config);
    default:
      throw new Error(`Unknown audio provider: ${name}`);
  }
}
