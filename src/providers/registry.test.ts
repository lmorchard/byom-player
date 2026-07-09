import { describe, it, expect } from 'vitest';
import { createProvider } from './registry';

describe('createProvider', () => {
  it('creates a spotify provider', () => {
    const p = createProvider('spotify', {
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
    });
    expect(p.name).toBe('spotify');
  });
  it('creates a plex provider', () => {
    const p = createProvider('plex', { baseUrl: 'https://plex.example:32400', token: 'TK' });
    expect(p.name).toBe('plex');
  });
  it('throws on an unknown provider', () => {
    expect(() => createProvider('nope', {})).toThrow();
  });
});
