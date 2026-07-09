import {
  PLEX_PRODUCT,
  type LinkResult,
  type PlexAuthLike,
  type PlexConfig,
  type PlexSession,
} from './types';

const PLEX_TV = 'https://plex.tv/api/v2';
const AUTH_APP = 'https://app.plex.tv/auth';
const CLIENT_ID_KEY = 'byom-plex:client-id';
const SESSION_KEY = 'byom-plex:session';

type Fetch = typeof fetch;
type Discover = (accountToken: string) => Promise<LinkResult>;

export function clientIdentifier(storage: Storage = localStorage): string {
  let id = storage.getItem(CLIENT_ID_KEY);
  if (!id) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    storage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export interface PlexAuthDeps {
  fetch?: Fetch;
  win?: Window;
  storage?: Storage;
  now?: () => number;
  discover?: Discover; // real implementation supplied in Task 3 (server discovery)
  pollIntervalMs?: number;
  maxPolls?: number;
}

export class PlexAuth implements PlexAuthLike {
  private readonly fetch: Fetch;
  private readonly win: Window;
  private readonly storage: Storage;
  private readonly discover: Discover;
  private readonly pollIntervalMs: number;
  private readonly maxPolls: number;
  private readonly product: string;
  private readonly clientId: string;
  private readonly serverName?: string;
  // Set during link() so a deferred server pick can complete via selectServer().
  private accountToken?: string;
  private servers?: { id: string; name: string }[];

  constructor(cfg: PlexConfig, deps: PlexAuthDeps = {}) {
    this.fetch = deps.fetch ?? fetch.bind(globalThis);
    this.win = deps.win ?? window;
    this.storage = deps.storage ?? localStorage;
    this.discover = deps.discover ?? ((token) => this.defaultDiscover(token));
    this.pollIntervalMs = deps.pollIntervalMs ?? 1500;
    this.maxPolls = deps.maxPolls ?? 120; // ~3 min at 1.5s
    this.product = cfg.product ?? PLEX_PRODUCT;
    this.serverName = cfg.serverName;
    this.clientId = clientIdentifier(this.storage);
  }

  // Real discovery: resolve a single server to a session, or stash the account
  // token + server list so selectServer() can finish a multi-server pick.
  private async defaultDiscover(accountToken: string): Promise<LinkResult> {
    this.accountToken = accountToken;
    const out = await discoverSession(
      { fetch: this.fetch, headers: this.headers() },
      accountToken,
      { serverName: this.serverName },
    );
    if (out.session) return out.session;
    this.servers = out.servers ?? [];
    return { servers: this.servers };
  }

  pendingServers(): { id: string; name: string }[] {
    return this.servers ?? [];
  }

  async selectServer(id: string): Promise<PlexSession> {
    if (!this.accountToken) throw new Error('link() must run before selectServer()');
    const res = await this.fetch(`${PLEX_TV}/resources?includeHttps=1`, {
      headers: { ...this.headers(), 'X-Plex-Token': this.accountToken },
    });
    const all = (await res.json()) as PlexResource[];
    const srv = all.find((r) => r.clientIdentifier === id);
    if (!srv) throw new Error('Unknown Plex server');
    const baseUrl = await pickConnection(
      this.fetch,
      this.headers(),
      srv.connections,
      srv.accessToken,
    );
    const session = { baseUrl, token: srv.accessToken };
    this.persist(session);
    return session;
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'X-Plex-Product': this.product,
      'X-Plex-Client-Identifier': this.clientId,
      'X-Plex-Version': '1',
    };
  }

  hasSession(): boolean {
    return this.storage.getItem(SESSION_KEY) !== null;
  }

  async getSession(): Promise<PlexSession | null> {
    const raw = this.storage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlexSession;
    } catch {
      return null;
    }
  }

  logout(): void {
    this.storage.removeItem(SESSION_KEY);
  }

  protected persist(session: PlexSession): void {
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async link(): Promise<LinkResult> {
    const pin = await this.createPin();
    const url = `${AUTH_APP}#?clientID=${encodeURIComponent(this.clientId)}&code=${encodeURIComponent(
      pin.code,
    )}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(this.product)}`;
    const popup = this.win.open(url, 'plex-link', 'width=600,height=720');
    const accountToken = await this.pollForToken(pin.id, popup);
    const result = await this.discover(accountToken);
    if (!('servers' in result)) this.persist(result);
    try {
      popup?.close();
    } catch {
      /* ignore */
    }
    return result;
  }

  private async createPin(): Promise<{ id: number; code: string }> {
    const res = await this.fetch(`${PLEX_TV}/pins?strong=true`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Plex pin request failed: ${res.status}`);
    const data = (await res.json()) as { id: number; code: string };
    return { id: data.id, code: data.code };
  }

  private async pollForToken(id: number, popup: Window | null): Promise<string> {
    for (let i = 0; i < this.maxPolls; i++) {
      if (popup?.closed) throw new Error('Plex login popup was closed');
      const res = await this.fetch(`${PLEX_TV}/pins/${id}`, { headers: this.headers() });
      const data = (await res.json()) as { authToken: string | null };
      if (data.authToken) return data.authToken;
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
    throw new Error('Plex authorization timed out');
  }
}

interface PlexResource {
  name: string;
  provides: string;
  clientIdentifier: string;
  accessToken: string;
  connections: { local: boolean; uri: string }[];
}

// Return the first reachable connection uri, preferring local over remote
// (plex.direct), probing each with GET {uri}/identity.
export async function pickConnection(
  fetchFn: Fetch,
  headers: Record<string, string>,
  connections: { local: boolean; uri: string }[],
  accessToken: string,
): Promise<string> {
  const ordered = [...connections].sort((a, b) => Number(b.local) - Number(a.local));
  for (const c of ordered) {
    const uri = c.uri.replace(/\/$/, '');
    try {
      const res = await fetchFn(`${uri}/identity`, {
        headers: { ...headers, 'X-Plex-Token': accessToken },
      });
      if (res.ok) return uri;
    } catch {
      /* try next connection */
    }
  }
  throw new Error('No reachable Plex connection');
}

// Discover the account's servers. Resolves a single session when there's exactly
// one server (or a serverName match); otherwise returns the list for a picker.
export async function discoverSession(
  deps: { fetch: Fetch; headers: Record<string, string> },
  accountToken: string,
  opts: { serverName?: string },
): Promise<{ session?: PlexSession; servers?: { id: string; name: string }[] }> {
  const res = await deps.fetch(`${PLEX_TV}/resources?includeHttps=1`, {
    headers: { ...deps.headers, 'X-Plex-Token': accountToken },
  });
  if (!res.ok) throw new Error(`Plex resources request failed: ${res.status}`);
  const all = (await res.json()) as PlexResource[];
  const servers = all.filter((r) => r.provides?.split(',').includes('server'));
  if (servers.length === 0) throw new Error('No Plex servers on this account');

  let chosen: PlexResource | undefined;
  if (opts.serverName) chosen = servers.find((s) => s.name === opts.serverName);
  else if (servers.length === 1) chosen = servers[0];

  if (!chosen) {
    return { servers: servers.map((s) => ({ id: s.clientIdentifier, name: s.name })) };
  }
  const baseUrl = await pickConnection(
    deps.fetch,
    deps.headers,
    chosen.connections,
    chosen.accessToken,
  );
  return { session: { baseUrl, token: chosen.accessToken } };
}
