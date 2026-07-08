import type { AudioProvider } from './types';
import { MockProvider } from './MockProvider';

// createProvider maps a provider name (+ config) to an AudioProvider instance.
// DirectProvider is registered in a later phase; unknown names are an error.
export function createProvider(name: string, _config: Record<string, unknown>): AudioProvider {
  switch (name) {
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(`Unknown audio provider: ${name}`);
  }
}
