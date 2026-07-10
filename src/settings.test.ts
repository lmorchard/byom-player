import { describe, it, expect, beforeEach } from 'vitest';
import {
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
  effectiveProviderConfig,
  type UserSettings,
} from './settings';

describe('settings', () => {
  beforeEach(() => localStorage.clear());

  it('loads a normalized empty shape when nothing is stored', () => {
    expect(loadSettings()).toEqual({ providers: {} });
  });

  it('round-trips saved settings', () => {
    const s: UserSettings = {
      provider: 'subsonic',
      debug: true,
      providers: { subsonic: { baseUrl: 'https://m.example.com', username: 'me' } },
    };
    saveSettings(s);
    expect(localStorage.getItem(SETTINGS_KEY)).toContain('subsonic');
    expect(loadSettings()).toEqual(s);
  });

  it('round-trips a theme selection', () => {
    saveSettings({ providers: {}, theme: 'midnight' });
    expect(loadSettings().theme).toBe('midnight');
  });

  it('returns the empty shape on malformed JSON (never throws)', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings()).toEqual({ providers: {} });
  });

  it('merges deployment defaults with user creds (user wins)', () => {
    const deployment = { spotify: { clientId: 'abc', redirectUri: 'https://x/cb' } };
    const user: UserSettings = { providers: { spotify: { clientId: 'user-override' } } };
    expect(effectiveProviderConfig('spotify', deployment, user)).toEqual({
      clientId: 'user-override',
      redirectUri: 'https://x/cb',
    });
  });

  it('returns just deployment config when no user creds for that provider', () => {
    const deployment = { youtube: { apiKey: 'k' } };
    expect(effectiveProviderConfig('youtube', deployment, { providers: {} })).toEqual({
      apiKey: 'k',
    });
  });
});
