import { randomVerifier, challengeFromVerifier, authorizeUrl } from './pkce';
import type { SpotifyConfig, AuthLike } from './types';

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const EXPIRY_SKEW_MS = 60_000; // refresh a minute early

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// localStorage-backed token cache, scoped by clientId.
export class TokenStore {
  constructor(
    private readonly clientId: string,
    private readonly storage: Storage = localStorage,
  ) {}
  private key(): string {
    return `byom-spotify:${this.clientId}`;
  }
  load(): Tokens | null {
    const raw = this.storage.getItem(this.key());
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Tokens;
    } catch {
      return null;
    }
  }
  save(t: Tokens): void {
    this.storage.setItem(this.key(), JSON.stringify(t));
  }
  clear(): void {
    this.storage.removeItem(this.key());
  }
}

type Clock = () => number;

async function postToken(
  body: URLSearchParams,
  now: Clock,
  priorRefresh?: string,
): Promise<Tokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token endpoint returned ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? priorRefresh ?? '',
    expiresAt: now() + data.expires_in * 1000,
  };
}

export function exchangeCode(
  cfg: SpotifyConfig,
  code: string,
  verifier: string,
  now: Clock = Date.now,
): Promise<Tokens> {
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      code_verifier: verifier,
    }),
    now,
  );
}

export function refreshTokens(
  cfg: SpotifyConfig,
  refreshToken: string,
  now: Clock = Date.now,
): Promise<Tokens> {
  return postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: cfg.clientId,
    }),
    now,
    refreshToken,
  );
}

export interface AuthDeps {
  store?: TokenStore;
  win?: Window;
  now?: Clock;
}

// Owns the client-side PKCE flow and the token cache.
export class AuthClient implements AuthLike {
  private readonly store: TokenStore;
  private readonly win: Window;
  private readonly now: Clock;

  constructor(
    private readonly cfg: SpotifyConfig,
    deps: AuthDeps = {},
  ) {
    this.store = deps.store ?? new TokenStore(cfg.clientId);
    this.win = deps.win ?? window;
    this.now = deps.now ?? Date.now;
  }

  hasToken(): boolean {
    return this.store.load() !== null;
  }

  async getValidToken(): Promise<string | null> {
    const t = this.store.load();
    if (!t) return null;
    if (t.expiresAt - EXPIRY_SKEW_MS > this.now()) return t.accessToken;
    const refreshed = await refreshTokens(this.cfg, t.refreshToken, this.now);
    this.store.save(refreshed);
    return refreshed.accessToken;
  }

  // Opens the authorize popup, awaits the code via postMessage, exchanges it.
  async login(): Promise<string> {
    const verifier = randomVerifier();
    const challenge = await challengeFromVerifier(verifier);
    const popup = this.win.open(
      authorizeUrl(this.cfg, challenge),
      'spotify-login',
      'width=480,height=720',
    );
    if (!popup) throw new Error('Spotify login popup was blocked');
    const code = await this.awaitCode(popup);
    const tokens = await exchangeCode(this.cfg, code, verifier, this.now);
    this.store.save(tokens);
    return tokens.accessToken;
  }

  private awaitCode(popup: Window): Promise<string> {
    const expectedOrigin = new URL(this.cfg.redirectUri).origin;
    return new Promise<string>((resolve, reject) => {
      const handler = (ev: MessageEvent) => {
        if (ev.origin !== expectedOrigin || typeof ev.data !== 'string') return;
        const params = new URLSearchParams(ev.data);
        const code = params.get('code');
        const err = params.get('error');
        if (!code && !err) return;
        cleanup();
        if (err) reject(new Error(`Spotify authorization failed: ${err}`));
        else resolve(code!);
      };
      const timer = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error('Spotify login popup was closed'));
        }
      }, 500);
      const cleanup = () => {
        this.win.removeEventListener('message', handler);
        clearInterval(timer);
        try {
          popup.close();
        } catch {
          /* ignore */
        }
      };
      this.win.addEventListener('message', handler);
    });
  }
}
