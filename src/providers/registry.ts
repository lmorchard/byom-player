import type { AudioProvider } from './types';
import { MockProvider } from './MockProvider';
import { DirectProvider } from './DirectProvider';

// createProvider maps a provider name (+ config) to an AudioProvider instance.
// Unknown names are an error.
export function createProvider(name: string, config: Record<string, unknown>): AudioProvider {
  switch (name) {
    case 'mock':
      return new MockProvider();
    case 'direct':
      return new DirectProvider(config);
    default:
      throw new Error(`Unknown audio provider: ${name}`);
  }
}
