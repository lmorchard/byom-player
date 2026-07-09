import type { ProviderState } from '../types';

// Non-Premium accounts surface as this typed error so the provider can fall
// back to the embed tier instead of treating it as a generic playback error.
export class NotPremiumError extends Error {
  constructor(message = 'Spotify account is not Premium') {
    super(message);
    this.name = 'NotPremiumError';
  }
}

export type EngineKind = 'sdk' | 'embed';

// A playback engine behind the provider. Mirrors YouTubeEngine so the provider
// is unit-tested against a fake and the real engines stay browser-only.
export interface SpotifyEngine {
  ready(): Promise<void>; // rejects with NotPremiumError when the account can't stream
  attach(element: HTMLElement): void; // embed mounts here; the SDK is headless
  load(uri: string): Promise<void>; // full uri, e.g. 'spotify:track:<id>'
  play(): void;
  pause(): void;
  seek(positionMs: number): void;
  currentTimeMs(): number;
  durationMs(): number;
  onState(cb: (state: ProviderState) => void): void;
  destroy(): void;
}

// The subset of AuthClient the provider depends on (kept small for test fakes).
export interface AuthLike {
  hasToken(): boolean;
  getValidToken(): Promise<string | null>;
  login(): Promise<string>;
  logout(): void;
}

export interface SpotifyConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  deviceName?: string;
  forceEmbed?: boolean;
  // Test seams (production defaults build the real engines / AuthClient):
  engineFactory?: (kind: EngineKind, getToken: () => Promise<string | null>) => SpotifyEngine;
  auth?: AuthLike;
  debug?: boolean;
}

export const DEFAULT_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state', // required to control the SDK device via /me/player
];
