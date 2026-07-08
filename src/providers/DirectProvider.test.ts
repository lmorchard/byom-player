import { describe, it, expect, afterEach, vi } from 'vitest';
import { DirectProvider } from './DirectProvider';
import type { ProviderState } from './types';

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

afterEach(() => vi.restoreAllMocks());

describe('DirectProvider', () => {
  it('resolve builds a search3 URL from "{artist} {title}" and returns the top song id', async () => {
    const fetchMock = mockSearch({ id: 'song-42', title: 'Nightcall' });
    const p = new DirectProvider({
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
    expect(url.searchParams.get('p')).toBe('pw');
    expect(url.searchParams.get('c')).toBe('byom-player');
    expect(url.searchParams.get('f')).toBe('json');
  });

  it('emits unavailable (not error) when the server has no match', async () => {
    mockSearch(null);
    const states: ProviderState[] = [];
    const p = new DirectProvider({ baseUrl: 'https://nav.example', username: 'u', password: 'p' });
    p.onStateChange((s) => states.push(s));
    await p.load({ title: 'X', artist: 'Y' });
    expect(states).toContain('unavailable');
    expect(states).not.toContain('error');
  });

  it('streamUrl includes id + auth + client params', () => {
    const p = new DirectProvider({ baseUrl: 'https://nav.example/', apiKey: 'KEY123' });
    const u = new URL(p.streamUrl('song-42'));
    expect(u.pathname).toBe('/rest/stream.view');
    expect(u.searchParams.get('id')).toBe('song-42');
    expect(u.searchParams.get('apiKey')).toBe('KEY123');
    expect(u.searchParams.get('c')).toBe('byom-player');
  });

  it('supports token + salt auth', () => {
    const p = new DirectProvider({
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
    const p = new DirectProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
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
    const p = new DirectProvider({ baseUrl: 'https://nav.example', apiKey: 'K', retryDelayMs: 0 });
    const id = await p.resolve({ title: 'T', artist: 'A' });
    expect(id).toBe('s9');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after exhausting retries; load emits error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('server down'));
    const states: ProviderState[] = [];
    const p = new DirectProvider({ baseUrl: 'https://nav.example', apiKey: 'K', retryDelayMs: 0 });
    p.onStateChange((s) => states.push(s));
    await p.load({ title: 'T', artist: 'A' });
    expect(states).toContain('error');
  });

  it('checkAvailability: available / unavailable / unknown', async () => {
    const p = new DirectProvider({ baseUrl: 'https://nav.example', apiKey: 'K', retryDelayMs: 0 });

    mockSearch({ id: 's1' });
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('available');

    vi.restoreAllMocks();
    mockSearch(null);
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unavailable');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    expect(await p.checkAvailability({ title: 'T', artist: 'A' })).toBe('unknown');
  });

  it('sets the audio source to the stream URL on successful load', async () => {
    mockSearch({ id: 'song-99' });
    const p = new DirectProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
    await p.load({ title: 'T', artist: 'A' });
    const audio = (p as any).audio as HTMLAudioElement;
    expect(audio.src).toContain('/rest/stream.view');
    expect(audio.src).toContain('id=song-99');
  });
});
