import { describe, it, expect, vi, afterEach } from 'vitest';
import { TokenStore, exchangeCode, refreshTokens, AuthClient } from './auth';
import type { SpotifyConfig } from './types';

const CFG: SpotifyConfig = { clientId: 'CID', redirectUri: 'https://x.test/callback.html' };

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

class FakeStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

afterEach(() => vi.restoreAllMocks());

describe('TokenStore', () => {
  it('round-trips and clears, scoped by clientId', () => {
    const s = new FakeStorage();
    const store = new TokenStore('CID', s);
    expect(store.load()).toBeNull();
    store.save({ accessToken: 'a', refreshToken: 'r', expiresAt: 123 });
    expect(store.load()).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: 123 });
    expect(new TokenStore('OTHER', s).load()).toBeNull(); // scoped
    store.clear();
    expect(store.load()).toBeNull();
  });
});

describe('exchangeCode / refreshTokens', () => {
  it('exchanges an auth code for tokens with the PKCE params', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okJson({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }));
    const t = await exchangeCode(CFG, 'CODE', 'VERIFIER', () => 1000);
    expect(t).toEqual({ accessToken: 'AT', refreshToken: 'RT', expiresAt: 1000 + 3600_000 });
    const body = fetchMock.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('CODE');
    expect(body.get('code_verifier')).toBe('VERIFIER');
    expect(body.get('client_id')).toBe('CID');
  });

  it('keeps the prior refresh token when refresh omits one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ access_token: 'AT2', expires_in: 3600 }),
    );
    const t = await refreshTokens(CFG, 'OLD_RT', () => 0);
    expect(t.accessToken).toBe('AT2');
    expect(t.refreshToken).toBe('OLD_RT'); // preserved
  });

  it('throws on a non-ok token response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 400 } as Response);
    await expect(exchangeCode(CFG, 'C', 'V')).rejects.toThrow();
  });
});

describe('AuthClient.getValidToken', () => {
  it('returns null with no stored token', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    const auth = new AuthClient(CFG, { store });
    expect(await auth.getValidToken()).toBeNull();
    expect(auth.hasToken()).toBe(false);
  });

  it('logout clears the stored token', () => {
    const store = new TokenStore('CID', new FakeStorage());
    store.save({ accessToken: 'AT', refreshToken: 'RT', expiresAt: 999_999 });
    const auth = new AuthClient(CFG, { store });
    expect(auth.hasToken()).toBe(true);
    auth.logout();
    expect(auth.hasToken()).toBe(false);
  });

  it('returns the cached token when unexpired', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    store.save({ accessToken: 'AT', refreshToken: 'RT', expiresAt: 120_000 }); // beyond the 60s skew
    const auth = new AuthClient(CFG, { store, now: () => 0 });
    expect(await auth.getValidToken()).toBe('AT');
  });

  it('refreshes an expired token and persists the result', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    store.save({ accessToken: 'OLD', refreshToken: 'RT', expiresAt: 0 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ access_token: 'NEW', refresh_token: 'RT2', expires_in: 3600 }),
    );
    const auth = new AuthClient(CFG, { store, now: () => 1000 });
    expect(await auth.getValidToken()).toBe('NEW');
    expect(store.load()!.accessToken).toBe('NEW');
    expect(store.load()!.refreshToken).toBe('RT2');
  });
});

describe('AuthClient.login (popup + postMessage)', () => {
  it('opens a popup, receives the code, exchanges it, and stores tokens', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    let messageHandler: ((ev: MessageEvent) => void) | null = null;
    const popup = { closed: false, close: vi.fn() };
    const win = {
      open: vi.fn(() => popup),
      addEventListener: vi.fn((_t: string, h: (ev: MessageEvent) => void) => {
        messageHandler = h;
      }),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }),
    );

    const auth = new AuthClient(CFG, { store, win, now: () => 0 });
    const p = auth.login();
    await vi.waitFor(() => expect(messageHandler).not.toBeNull());

    // wrong origin is ignored
    messageHandler!({ origin: 'https://evil.test', data: '?code=NOPE' } as MessageEvent);
    // correct origin delivers the code
    messageHandler!({ origin: 'https://x.test', data: '?code=THECODE' } as MessageEvent);

    expect(await p).toBe('AT');
    expect(store.load()!.accessToken).toBe('AT');
    expect(win.open).toHaveBeenCalled();
  });

  it('rejects when the popup is blocked', async () => {
    const store = new TokenStore('CID', new FakeStorage());
    const win = {
      open: vi.fn(() => null),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    const auth = new AuthClient(CFG, { store, win });
    await expect(auth.login()).rejects.toThrow(/popup/i);
  });
});
