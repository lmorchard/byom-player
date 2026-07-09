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

  constructor(cfg: PlexConfig, deps: PlexAuthDeps = {}) {
    this.fetch = deps.fetch ?? fetch.bind(globalThis);
    this.win = deps.win ?? window;
    this.storage = deps.storage ?? localStorage;
    // Task 3 replaces the default with real server discovery.
    this.discover =
      deps.discover ??
      (async () => {
        throw new Error('Plex server discovery not configured');
      });
    this.pollIntervalMs = deps.pollIntervalMs ?? 1500;
    this.maxPolls = deps.maxPolls ?? 120; // ~3 min at 1.5s
    this.product = cfg.product ?? PLEX_PRODUCT;
    this.clientId = clientIdentifier(this.storage);
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
