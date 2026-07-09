import type { ResolutionCache } from '../resolutionCache';

export interface PlexSession {
  baseUrl: string;
  token: string;
}

// Result of a link attempt: a resolved session, or a set of servers to pick from
// when the account has more than one and no serverName disambiguates.
export type LinkResult = PlexSession | { servers: { id: string; name: string }[] };

// The subset of the PIN/discovery client the provider depends on (small for fakes).
export interface PlexAuthLike {
  hasSession(): boolean;
  getSession(): Promise<PlexSession | null>;
  link(): Promise<LinkResult>;
  logout(): void;
  pendingServers?(): { id: string; name: string }[];
  selectServer?(id: string): Promise<PlexSession>;
}

export interface PlexConfig {
  baseUrl?: string; // token-in: direct server URL
  token?: string; // token-in: X-Plex-Token
  serverName?: string; // PIN flow: auto-select this server when multiple
  product?: string; // X-Plex-Product (default 'byom-player')
  debug?: boolean;
  retries?: number; // extra attempts after the first (default 2)
  retryDelayMs?: number; // base backoff * attempt (default 400)
  cache?: boolean; // default on
  resolutionCache?: ResolutionCache; // test / custom backend injection
  auth?: PlexAuthLike; // test injection of the PIN/discovery client
}

export const PLEX_PRODUCT = 'byom-player';
