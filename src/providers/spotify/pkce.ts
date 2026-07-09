import { type SpotifyConfig, DEFAULT_SCOPES } from './types';

const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';
const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

// A cryptographically-random PKCE code_verifier from the RFC 7636 unreserved set.
export function randomVerifier(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += UNRESERVED[b % UNRESERVED.length];
  return out;
}

// S256 challenge = base64url( SHA-256(verifier) ), no padding.
export async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authorizeUrl(cfg: SpotifyConfig, challenge: string): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: (cfg.scopes ?? DEFAULT_SCOPES).join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString();
  return url.toString();
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
