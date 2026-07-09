import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlexAuth, clientIdentifier, discoverSession, pickConnection } from './auth';
import type { PlexSession } from './types';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  } as Storage;
}

afterEach(() => vi.restoreAllMocks());

describe('clientIdentifier', () => {
  it('generates once and persists', () => {
    const s = fakeStorage();
    const a = clientIdentifier(s);
    expect(a).toMatch(/\S/);
    expect(clientIdentifier(s)).toBe(a); // stable
  });
});

describe('PlexAuth PIN flow', () => {
  const SESSION: PlexSession = { baseUrl: 'https://s.plex.direct:32400', token: 'ACCESS' };

  function deps(overrides: Record<string, unknown> = {}) {
    return {
      storage: fakeStorage(),
      now: () => 0,
      discover: vi.fn(async () => SESSION), // real impl in Task 3
      ...overrides,
    };
  }

  it('creates a pin, opens the auth popup, polls until authToken, then discovers a session', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/pins?strong=true') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 42, code: 'ABCD' }) } as Response;
      }
      if (url.includes('/pins/42')) {
        calls++;
        return {
          ok: true,
          json: async () => ({ authToken: calls >= 2 ? 'ACCOUNT' : null }),
        } as Response;
      }
      throw new Error('unexpected ' + url);
    });
    const popup = { closed: false, close: vi.fn(), location: { href: '' } };
    const win = { open: vi.fn(() => popup) } as unknown as Window;
    const d = deps();
    const auth = new PlexAuth(
      { product: 'byom-player' },
      { ...d, fetch: fetchMock as unknown as typeof fetch, win, pollIntervalMs: 0 },
    );

    const session = await auth.link();
    expect(win.open).toHaveBeenCalled();
    expect(String((win.open as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      'app.plex.tv/auth',
    );
    expect(d.discover).toHaveBeenCalledWith('ACCOUNT');
    expect(session).toEqual(SESSION);
    expect(auth.hasSession()).toBe(true); // persisted
  });

  it('getSession returns the cached session; logout clears it', async () => {
    const d = deps();
    const auth = new PlexAuth(
      {},
      { ...d, fetch: vi.fn() as unknown as typeof fetch, win: {} as Window },
    );
    expect(await auth.getSession()).toBeNull();
    (auth as unknown as { persist: (s: PlexSession) => void }).persist(SESSION);
    expect(auth.hasSession()).toBe(true);
    expect(await auth.getSession()).toEqual(SESSION);
    auth.logout();
    expect(auth.hasSession()).toBe(false);
  });

  it('rejects when the popup is closed before authorization', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/pins?strong=true'))
        return { ok: true, json: async () => ({ id: 1, code: 'C' }) } as Response;
      return { ok: true, json: async () => ({ authToken: null }) } as Response; // never authorizes
    });
    const popup = { closed: true, close: vi.fn() };
    const win = { open: vi.fn(() => popup) } as unknown as Window;
    const auth = new PlexAuth(
      {},
      {
        ...deps(),
        fetch: fetchMock as unknown as typeof fetch,
        win,
        pollIntervalMs: 0,
        maxPolls: 3,
      },
    );
    await expect(auth.link()).rejects.toThrow(/closed|timed out/i);
  });
});

describe('pickConnection', () => {
  it('prefers a reachable local connection, falls back to plex.direct', async () => {
    const conns = [
      { local: false, uri: 'https://remote.plex.direct:32400' },
      { local: true, uri: 'https://192.168.1.9:32400' },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://192.168.1.9')) throw new Error('unreachable'); // local fails
      return { ok: true } as Response;
    });
    const uri = await pickConnection(fetchMock as unknown as typeof fetch, {}, conns, 'ACCESS');
    expect(uri).toBe('https://remote.plex.direct:32400');
  });
});

describe('discoverSession', () => {
  const base = {
    name: 'Home',
    provides: 'server',
    clientIdentifier: 'srv-1',
    accessToken: 'ACCESS1',
    connections: [{ local: true, uri: 'https://192.168.1.9:32400' }],
  };
  function fetchWith(resourcesJson: unknown) {
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/resources'))
        return { ok: true, json: async () => resourcesJson } as Response;
      if (url.includes('/identity')) return { ok: true } as Response;
      throw new Error('unexpected ' + url);
    });
  }

  it('auto-selects the only server and resolves a session', async () => {
    const out = await discoverSession(
      { fetch: fetchWith([base]) as unknown as typeof fetch, headers: {} },
      'ACCOUNT',
      {},
    );
    expect(out.session).toEqual({ baseUrl: 'https://192.168.1.9:32400', token: 'ACCESS1' });
  });

  it('returns the server list when there are multiple and no serverName', async () => {
    const two = [
      { ...base, clientIdentifier: 'a', name: 'A' },
      { ...base, clientIdentifier: 'b', name: 'B' },
    ];
    const out = await discoverSession(
      { fetch: fetchWith(two) as unknown as typeof fetch, headers: {} },
      'ACCOUNT',
      {},
    );
    expect(out.session).toBeUndefined();
    expect(out.servers).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
  });

  it('auto-selects by serverName when multiple', async () => {
    const two = [
      { ...base, clientIdentifier: 'a', name: 'A' },
      { ...base, clientIdentifier: 'b', name: 'B' },
    ];
    const out = await discoverSession(
      { fetch: fetchWith(two) as unknown as typeof fetch, headers: {} },
      'ACCOUNT',
      { serverName: 'B' },
    );
    expect(out.session?.token).toBe('ACCESS1');
  });
});
