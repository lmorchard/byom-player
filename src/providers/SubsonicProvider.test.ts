import { describe, it, expect, afterEach, vi } from 'vitest';
import { SubsonicProvider } from './SubsonicProvider';
import type { ProviderState } from './types';
import { md5 } from '../md5';

function mockSearch(song: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      'subsonic-response': { status: 'ok', searchResult3: song ? { song: [song] } : {} },
    }),
  } as Response);
}

function okResponse(song: unknown) {
  return {
    ok: true,
    json: async () => ({
      'subsonic-response': { status: 'ok', searchResult3: { song: [song] } },
    }),
  } as Response;
}

// fetch mock that answers search3 with one song and everything else (scrobble) with ok
function mockServer(songId = 'song-1') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('search3.view')) {
      return {
        ok: true,
        json: async () => ({
          'subsonic-response': { status: 'ok', searchResult3: { song: [{ id: songId }] } },
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({ 'subsonic-response': { status: 'ok' } }) } as Response;
  });
}

function scrobbleCalls(fetchMock: { mock: { calls: unknown[][] } }) {
  return fetchMock.mock.calls
    .map((c) => new URL(c[0] as string))
    .filter((u) => u.pathname === '/rest/scrobble.view');
}

afterEach(() => vi.restoreAllMocks());

describe('SubsonicProvider', () => {
  it('resolve builds a search3 URL from "{artist} {title}" and returns the top song id', async () => {
    const fetchMock = mockSearch({ id: 'song-42', title: 'Nightcall' });
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      username: 'les',
      password: 'pw',
    });

    const id = await p.resolve({ title: 'Nightcall', artist: 'Kavinsky' });
    expect(id).toBe('song-42');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/rest/search3.view');
    expect(url.searchParams.get('query')).toBe('Kavinsky Nightcall');
    expect(url.searchParams.get('u')).toBe('les');
    expect(url.searchParams.get('c')).toBe('byom-player');
    expect(url.searchParams.get('f')).toBe('json');
  });

  it('derives token+salt from a password (plaintext never sent)', () => {
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      username: 'les',
      password: 'pw',
    });
    const url = new URL(p.streamUrl('x'));
    expect(url.searchParams.get('p')).toBeNull(); // no plaintext password
    const salt = url.searchParams.get('s');
    const token = url.searchParams.get('t');
    expect(salt).toBeTruthy();
    expect(token).toBe(md5('pw' + salt)); // token = md5(password + salt)
  });

  it('emits unavailable (not error) when the server has no match', async () => {
    mockSearch(null);
    const states: ProviderState[] = [];
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      username: 'u',
      password: 'p',
    });
    p.onStateChange((s) => states.push(s));
    await p.load({ title: 'X', artist: 'Y' });
    expect(states).toContain('unavailable');
    expect(states).not.toContain('error');
  });

  it('streamUrl includes id + auth + client params', () => {
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example/', apiKey: 'KEY123' });
    const u = new URL(p.streamUrl('song-42'));
    expect(u.pathname).toBe('/rest/stream.view');
    expect(u.searchParams.get('id')).toBe('song-42');
    expect(u.searchParams.get('apiKey')).toBe('KEY123');
    expect(u.searchParams.get('c')).toBe('byom-player');
  });

  it('supports token + salt auth', () => {
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      username: 'les',
      token: 'abc123',
      salt: 'xyz',
    });
    const u = new URL(p.streamUrl('s1'));
    expect(u.searchParams.get('t')).toBe('abc123');
    expect(u.searchParams.get('s')).toBe('xyz');
    expect(u.searchParams.get('u')).toBe('les');
    expect(u.searchParams.get('p')).toBeNull();
  });

  it('maps HTML audio events to provider states', () => {
    const states: ProviderState[] = [];
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    p.onStateChange((s) => states.push(s));
    const audio = (p as any).audio as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('pause'));
    audio.dispatchEvent(new Event('ended'));
    audio.dispatchEvent(new Event('error'));
    expect(states).toEqual(['playing', 'paused', 'ended', 'error']);
  });

  it('retries transient failures before resolving', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network blip'))
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValue(okResponse({ id: 's9' }));
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      apiKey: 'K',
      retryDelayMs: 0,
    });
    const id = await p.resolve({ title: 'T', artist: 'A' });
    expect(id).toBe('s9');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after exhausting retries; load emits error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('server down'));
    const states: ProviderState[] = [];
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      apiKey: 'K',
      retryDelayMs: 0,
    });
    p.onStateChange((s) => states.push(s));
    await p.load({ title: 'T', artist: 'A' });
    expect(states).toContain('error');
  });

  it('checkAvailability: available / unavailable / unknown', async () => {
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      apiKey: 'K',
      retryDelayMs: 0,
    });

    mockSearch({ id: 's1' });
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('available');

    vi.restoreAllMocks();
    mockSearch(null);
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unavailable');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unknown');
  });

  it('seek sets the audio currentTime (ms -> s)', () => {
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    p.seek(30000);
    expect((p as any).audio.currentTime).toBe(30);
  });

  it('emits progress on timeupdate (position in ms)', () => {
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    const events: [number, number][] = [];
    p.onProgress((pos, dur) => events.push([pos, dur]));
    const audio = (p as any).audio as HTMLAudioElement;
    audio.currentTime = 12;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(events.length).toBeGreaterThan(0);
    expect(events.at(-1)![0]).toBe(12000);
    expect(typeof events.at(-1)![1]).toBe('number');
  });

  it('sets the audio source to the stream URL on successful load', async () => {
    mockSearch({ id: 'song-99' });
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    expect(audio.src).toContain('/rest/stream.view');
    expect(audio.src).toContain('id=song-99');
  });

  it('sends now-playing (submission=false) once when playback starts', async () => {
    const fetchMock = mockServer();
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('playing')); // must not re-send

    const nowPlaying = scrobbleCalls(fetchMock).filter(
      (u) => u.searchParams.get('submission') === 'false',
    );
    expect(nowPlaying.length).toBe(1);
    expect(nowPlaying[0].searchParams.get('id')).toBe('song-1');
    expect(nowPlaying[0].searchParams.get('time')).toBeTruthy();
    expect(nowPlaying[0].searchParams.get('c')).toBe('byom-player');
  });

  it('does not scrobble when scrobble: false', async () => {
    const fetchMock = mockServer();
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      apiKey: 'K',
      scrobble: false,
    });
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    expect(scrobbleCalls(fetchMock).length).toBe(0);
  });

  it('does not scrobble on playing when no track is loaded', () => {
    const fetchMock = mockServer();
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    const audio = (p as any).audio as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    expect(scrobbleCalls(fetchMock).length).toBe(0);
  });

  it('a failed scrobble does not emit error or throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('search3.view')) {
        return {
          ok: true,
          json: async () => ({
            'subsonic-response': { status: 'ok', searchResult3: { song: [{ id: 's1' }] } },
          }),
        } as Response;
      }
      throw new Error('scrobble network fail');
    });
    const states: ProviderState[] = [];
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    p.onStateChange((s) => states.push(s));
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    await new Promise((r) => setTimeout(r, 0)); // let the rejected promise settle
    expect(states).not.toContain('error');
  });

  it('submits (submission=true) once when position crosses half the duration', async () => {
    const fetchMock = mockServer();
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { value: 200, configurable: true }); // half = 100s

    audio.currentTime = 99;
    audio.dispatchEvent(new Event('timeupdate')); // below threshold
    expect(
      scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true'),
    ).toHaveLength(0);

    audio.currentTime = 100;
    audio.dispatchEvent(new Event('timeupdate')); // at threshold
    audio.currentTime = 180;
    audio.dispatchEvent(new Event('timeupdate')); // past threshold — must not re-send

    const subs = scrobbleCalls(fetchMock).filter(
      (u) => u.searchParams.get('submission') === 'true',
    );
    expect(subs).toHaveLength(1);
    expect(subs[0].searchParams.get('id')).toBe('song-1');
  });

  it('caps the submission threshold at 4 minutes for long tracks', async () => {
    const fetchMock = mockServer();
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { value: 3600, configurable: true }); // half = 1800s, cap = 240s

    audio.currentTime = 239;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(
      scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true'),
    ).toHaveLength(0);

    audio.currentTime = 240;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(
      scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true'),
    ).toHaveLength(1);
  });

  it('never submits tracks shorter than 30 seconds', async () => {
    const fetchMock = mockServer();
    const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { value: 20, configurable: true });

    audio.currentTime = 20; // played to the end
    audio.dispatchEvent(new Event('timeupdate'));
    expect(
      scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true'),
    ).toHaveLength(0);
  });

  it('does not submit when scrobble: false', async () => {
    const fetchMock = mockServer();
    const p = new SubsonicProvider({
      baseUrl: 'https://nav.example',
      apiKey: 'K',
      scrobble: false,
    });
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { value: 200, configurable: true });
    audio.currentTime = 150;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(scrobbleCalls(fetchMock)).toHaveLength(0);
  });
});
