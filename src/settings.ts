// User settings are the panel-edited, component-owned half of configuration:
// which provider is active, per-provider credentials, and the debug flag.
// Persisted to localStorage; degrades to an empty shape (never throws) when
// storage is unavailable or corrupt.

export const SETTINGS_KEY = 'byom-player:settings:v1';

export interface UserSettings {
  provider?: string;
  debug?: boolean;
  /** Selected named theme (e.g. 'midnight'); '' or absent = Auto (follow OS). */
  theme?: string;
  // Per-provider credentials/URLs the user typed in the panel, keyed by
  // provider name (e.g. { subsonic: { baseUrl, username, password } }).
  providers: Record<string, Record<string, string>>;
}

function storageOrNull(explicit?: Storage): Storage | null {
  if (explicit) return explicit;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(storage?: Storage): UserSettings {
  const s = storageOrNull(storage);
  if (!s) return { providers: {} };
  try {
    const raw = s.getItem(SETTINGS_KEY);
    if (!raw) return { providers: {} };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...parsed, providers: parsed.providers ?? {} };
  } catch {
    return { providers: {} };
  }
}

export function saveSettings(settings: UserSettings, storage?: Storage): void {
  const s = storageOrNull(storage);
  if (!s) return;
  try {
    s.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage full / unavailable — settings are best-effort
  }
}

// Effective config for one provider = deployment defaults for that provider,
// with the user's typed credentials layered on top (user wins).
export function effectiveProviderConfig(
  provider: string,
  deployment: Record<string, Record<string, unknown>>,
  user: UserSettings,
): Record<string, unknown> {
  return { ...(deployment[provider] ?? {}), ...(user.providers[provider] ?? {}) };
}
