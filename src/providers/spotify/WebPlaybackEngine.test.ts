import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebPlaybackEngine, __resetSharedPlayer } from './WebPlaybackEngine';
import type { SpotifyConfig } from './types';

// Minimal fake of window.Spotify.Player recording how many are constructed and
// exposing a way to fire SDK events.
class FakeSpotifyPlayer {
  static count = 0;
  static last: FakeSpotifyPlayer | null = null;
  listeners: Record<string, ((arg?: unknown) => void)[]> = {};
  connected = false;
  resumed = 0;
  paused = 0;
  constructor(public opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void }) {
    FakeSpotifyPlayer.count += 1;
    FakeSpotifyPlayer.last = this;
  }
  addListener(ev: string, cb: (arg?: unknown) => void) {
    (this.listeners[ev] ||= []).push(cb);
  }
  fire(ev: string, arg?: unknown) {
    (this.listeners[ev] || []).forEach((cb) => cb(arg));
  }
  connect() {
    this.connected = true;
    // The real SDK fires 'ready' asynchronously once the device registers.
    queueMicrotask(() => this.fire('ready', { device_id: 'DEVICE_' + FakeSpotifyPlayer.count }));
    return Promise.resolve(true);
  }
  disconnect() {
    this.connected = false;
  }
  resume() {
    this.resumed += 1;
    return Promise.resolve();
  }
  pause() {
    this.paused += 1;
    return Promise.resolve();
  }
  seek() {
    return Promise.resolve();
  }
}

const cfg = {
  clientId: 'c',
  redirectUri: 'r',
  deviceName: 'byom-test',
} as unknown as SpotifyConfig;
const getToken = async () => 'TOKEN';

beforeEach(() => {
  FakeSpotifyPlayer.count = 0;
  FakeSpotifyPlayer.last = null;
  (window as unknown as { Spotify: unknown }).Spotify = { Player: FakeSpotifyPlayer };
  __resetSharedPlayer();
});
afterEach(() => {
  vi.restoreAllMocks();
  __resetSharedPlayer();
  delete (window as unknown as { Spotify?: unknown }).Spotify;
});

describe('WebPlaybackEngine shared player', () => {
  it('reuses ONE SDK player across engine recreation (the provider-switch bug)', async () => {
    // First Spotify mount.
    const e1 = new WebPlaybackEngine(cfg, getToken);
    await e1.ready();
    e1.destroy(); // user switches to another provider

    // User returns to Spotify → a fresh engine, but it must NOT build a new
    // SDK player (a recreated device is unplayable — 404 "Device not found").
    const e2 = new WebPlaybackEngine(cfg, getToken);
    await e2.ready();

    expect(FakeSpotifyPlayer.count).toBe(1);
  });

  it('destroy() pauses but does NOT disconnect the shared player', async () => {
    const e1 = new WebPlaybackEngine(cfg, getToken);
    await e1.ready();
    const player = FakeSpotifyPlayer.last!;
    e1.destroy();
    expect(player.connected).toBe(true); // still alive for the next mount
    expect(player.paused).toBe(1); // audio stopped on switch-away
  });

  it('plays to the same, still-registered device id after switch-away-and-back', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 204 } as Response);
    const e1 = new WebPlaybackEngine(cfg, getToken);
    await e1.ready();
    e1.destroy();
    const e2 = new WebPlaybackEngine(cfg, getToken);
    await e2.ready();
    await e2.load('spotify:track:abc');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('device_id=DEVICE_1'); // reused device, not a dead new one
  });
});
