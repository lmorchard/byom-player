import { describe, it, expect } from 'vitest';
import { randomVerifier, challengeFromVerifier, authorizeUrl } from './pkce';

describe('pkce', () => {
  it('generates a verifier of the requested length from the unreserved set', () => {
    const v = randomVerifier(64);
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9._~-]+$/);
    expect(randomVerifier(64)).not.toBe(v); // random
  });

  it('derives a base64url S256 challenge (no padding, url-safe)', async () => {
    // Known RFC 7636 vector: verifier -> challenge
    const c = await challengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(c).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(c).not.toContain('=');
    expect(c).not.toContain('+');
    expect(c).not.toContain('/');
  });

  it('builds the authorize URL with all PKCE params', () => {
    const url = new URL(
      authorizeUrl({ clientId: 'CID', redirectUri: 'https://x.test/callback.html' }, 'CHAL'),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('CID');
    expect(url.searchParams.get('redirect_uri')).toBe('https://x.test/callback.html');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('CHAL');
    expect(url.searchParams.get('scope')).toBe(
      'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state',
    );
  });
});
