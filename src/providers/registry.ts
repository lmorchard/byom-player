import type { AudioProvider } from './types';
import { MockProvider } from './MockProvider';
import { SubsonicProvider } from './SubsonicProvider';

// createProvider maps a provider name (+ config) to an AudioProvider instance.
// Unknown names are an error.
export function createProvider(name: string, config: Record<string, unknown>): AudioProvider {
  switch (name) {
    case 'mock':
      return new MockProvider();
    case 'subsonic':
    case 'direct': // deprecated alias for 'subsonic'
      return new SubsonicProvider(config);
    default:
      throw new Error(`Unknown audio provider: ${name}`);
  }
}
