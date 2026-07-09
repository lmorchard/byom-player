import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyProvider, parseSpotifyId } from './SpotifyProvider';
import { NotPremiumError, type SpotifyEngine, type EngineKind, type AuthLike } from './types';
import type { ProviderState } from '../types';

class FakeEngine implements SpotifyEngine {
  kind: EngineKind;
  attached: HTMLElement | null = null;
  loaded: string | null = null;
  played = 0;
  paused = 0;
  seekedMs: number | null = null;
  destroyed = false;
  posMs = 0;
  durMs = 0;
  readyImpl: () => Promise<void> = async () => {};
  private stateCb: (s: ProviderState) => void = () => {};
  constructor(kind: EngineKind) {
    this.kind = kind;
  }
  ready() {
    return this.readyImpl();
  }
  attach(el: HTMLElement) {
    this.attached = el;
  }
  async load(uri: string) {
    this.loaded = uri;
  }
  play() {
    this.played += 1;
  }
  pause() {
    this.paused += 1;
  }
  seek(ms: number) {
    this.seekedMs = ms;
  }
  currentTimeMs() {
    return this.posMs;
  }
  durationMs() {
    return this.durMs;
  }
  onState(cb: (s: ProviderState) => void) {
    this.stateCb = cb;
  }
  destroy() {
    this.destroyed = true;
  }
  emit(s: ProviderState) {
    this.stateCb(s);
  }
}

// Auth that already has a valid token (SDK path taken without a popup).
const readyAuth: AuthLike = {
  hasToken: () => true,
  getValidToken: async () => 'TOKEN',
  login: async () => 'TOKEN',
  logout: () => {},
};

function makeProvider(engines: Record<EngineKind, FakeEngine>, auth: AuthLike = readyAuth) {
  return new SpotifyProvider({
    clientId: 'CID',
    redirectUri: 'https://x.test/callback.html',
    auth,
    engineFactory: (kind: EngineKind) => engines[kind],
  });
}

describe('parseSpotifyId', () => {
  it('parses open.spotify.com URLs and spotify: URIs, rejects others', () => {
    expect(parseSpotifyId('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(
      '4iV5W9uYEdYUVa79Axb7Rh',
    );
    expect(parseSpotifyId('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=abc')).toBe(
      '4iV5W9uYEdYUVa79Axb7Rh',
    );
    expect(parseSpotifyId('spotify:track:4iV5W9uYEdYUVa79Axb7Rh')).toBe('4iV5W9uYEdYUVa79Axb7Rh');
    expect(parseSpotifyId('https://example.com/x')).toBeNull();
    expect(parseSpotifyId(undefined)).toBeNull();
  });
});

describe('SpotifyProvider resolution', () => {
  it('loads the spotify: uri for a track with a spotifyUrl', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    const el = document.createElement('div');
    p.attach(el);
    await p.initialize();
    await p.load({ title: 'T', artist: 'A', spotifyUrl: 'https://open.spotify.com/track/ABC' });
    expect(engines.sdk.loaded).toBe('spotify:track:ABC');
  });

  it('emits unavailable when the track has no Spotify URL', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    const states: ProviderState[] = [];
    p.onStateChange((s) => states.push(s));
    p.attach(document.createElement('div'));
    await p.initialize();
    await p.load({ title: 'T', artist: 'A' });
    expect(states.at(-1)).toBe('unavailable');
    expect(engines.sdk.loaded).toBeNull();
  });

  it('checkAvailability is a network-less URL parse', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    expect(
      await p.checkAvailability({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:X' }),
    ).toBe('available');
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unavailable');
  });

  it('isResolutionCached is true when a Spotify URL is present (prescan skips its throttle)', () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    expect(p.isResolutionCached({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:X' })).toBe(
      true,
    );
    expect(p.isResolutionCached({ title: 'T', artist: 'A' })).toBe(false); // no URL to resolve from
  });
});

describe('SpotifyProvider playback plumbing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delegates play/pause/seek and forwards state + ticked progress', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = makeProvider(engines);
    const states: ProviderState[] = [];
    const progress: [number, number][] = [];
    p.onStateChange((s) => states.push(s));
    p.onProgress((pos, dur) => progress.push([pos, dur]));
    p.attach(document.createElement('div'));
    await p.initialize();

    await p.play();
    expect(engines.sdk.played).toBe(1);
    engines.sdk.posMs = 5000;
    engines.sdk.durMs = 180000;
    engines.sdk.emit('playing');
    expect(states.at(-1)).toBe('playing');
    vi.advanceTimersByTime(250);
    expect(progress.at(-1)).toEqual([5000, 180000]);

    p.seek(30000);
    expect(engines.sdk.seekedMs).toBe(30000);
    p.pause();
    expect(engines.sdk.paused).toBe(1);

    engines.sdk.emit('paused'); // ticker stops
    p.dispose();
    expect(engines.sdk.destroyed).toBe(true);
  });
});

describe('SpotifyProvider engine selection', () => {
  it('uses the embed engine when forceEmbed is set', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    const p = new SpotifyProvider({
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
      auth: readyAuth,
      forceEmbed: true,
      engineFactory: (kind: EngineKind) => engines[kind],
    });
    p.attach(document.createElement('div'));
    await p.initialize();
    await p.load({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:Z' });
    expect(engines.embed.loaded).toBe('spotify:track:Z');
    expect(engines.sdk.loaded).toBeNull();
  });

  it('falls back to embed when the SDK reports NotPremiumError', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    engines.sdk.readyImpl = async () => {
      throw new NotPremiumError();
    };
    const p = new SpotifyProvider({
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
      auth: readyAuth,
      engineFactory: (kind: EngineKind) => engines[kind],
    });
    p.attach(document.createElement('div'));
    await p.initialize();
    await p.load({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:Z' });
    expect(engines.embed.loaded).toBe('spotify:track:Z');
  });

  it('renders a Connect button when there is no token, then connects on click', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    let loggedIn = false;
    const auth: AuthLike = {
      hasToken: () => loggedIn,
      getValidToken: async () => (loggedIn ? 'TOKEN' : null),
      login: async () => {
        loggedIn = true;
        return 'TOKEN';
      },
      logout: () => {
        loggedIn = false;
      },
    };
    const el = document.createElement('div');
    const p = new SpotifyProvider({
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
      auth,
      engineFactory: (kind: EngineKind) => engines[kind],
    });
    p.attach(el);
    await p.initialize();

    // Disconnected mounts the embed for playback AND shows a Connect button.
    expect(engines.embed.attached).toBe(el);
    const btn = el.querySelector('.byom-spotify-connect');
    expect(btn).not.toBeNull();
    expect(engines.sdk.loaded).toBeNull(); // SDK not connected yet

    (btn as HTMLButtonElement).click();
    await vi.waitFor(() => expect(engines.sdk.attached).toBe(el));
    await p.load({ title: 'T', artist: 'A', spotifyUrl: 'spotify:track:Z' });
    expect(engines.sdk.loaded).toBe('spotify:track:Z');
  });

  it('shows a Disconnect button once connected, and logs out + destroys on click', async () => {
    const engines = { sdk: new FakeEngine('sdk'), embed: new FakeEngine('embed') };
    let loggedIn = true;
    const auth: AuthLike = {
      hasToken: () => loggedIn,
      getValidToken: async () => (loggedIn ? 'TOKEN' : null),
      login: async () => {
        loggedIn = true;
        return 'TOKEN';
      },
      logout: () => {
        loggedIn = false;
      },
    };
    const el = document.createElement('div');
    const p = new SpotifyProvider({
      clientId: 'CID',
      redirectUri: 'https://x.test/callback.html',
      auth,
      engineFactory: (kind: EngineKind) => engines[kind],
    });
    p.attach(el);
    await p.initialize();

    const disconnect = el.querySelector('.byom-spotify-disconnect');
    expect(disconnect).not.toBeNull();

    (disconnect as HTMLButtonElement).click();
    // Disconnect logs out, tears down the SDK, and returns to the embed + Connect state.
    await vi.waitFor(() => expect(el.querySelector('.byom-spotify-connect')).not.toBeNull());
    expect(loggedIn).toBe(false);
    expect(engines.sdk.destroyed).toBe(true);
  });
});
