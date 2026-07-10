// Host-side (deployment) configuration parsing. Attribute-first: the static-site
// deployment authors HTML, so every host value has a string-attribute form.
// The flat `providerConfig` object stays as a programmatic escape hatch.

export const ALL_PROVIDERS = [
  'mock',
  'subsonic',
  'youtube',
  'spotify',
  'plex',
  'jellyfin',
] as const;

// parseProviderList turns the `providers` allowlist attribute into a filtered
// list of known providers, defaulting to all when unset or when it names none.
export function parseProviderList(csv: string | null): string[] {
  if (!csv) return [...ALL_PROVIDERS];
  const wanted = csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => (ALL_PROVIDERS as readonly string[]).includes(s));
  return wanted.length ? wanted : [...ALL_PROVIDERS];
}

export interface PlaylistEntry {
  title: string;
  src: string;
}

// parsePlaylistChildren reads <byom-playlist title src> light-DOM children.
// They need not be registered custom elements — we only read attributes.
export function parsePlaylistChildren(host: Element): PlaylistEntry[] {
  const out: PlaylistEntry[] = [];
  for (const el of Array.from(host.querySelectorAll('byom-playlist'))) {
    const src = el.getAttribute('src');
    if (!src) continue;
    out.push({ title: el.getAttribute('title') ?? src, src });
  }
  return out;
}

export interface DeploymentAttrs {
  spotifyClientId?: string;
  spotifyRedirectUri?: string;
  youtubeApiKey?: string;
  youtubeSearchEndpoint?: string;
}

// buildDeploymentConfig assembles per-provider deployment defaults from the
// host's attributes, then folds the flat providerConfig escape hatch into the
// initial provider (backward compat). Attributes win over the escape hatch.
export function buildDeploymentConfig(
  attrs: DeploymentAttrs,
  providerConfig: Record<string, unknown>,
  initialProvider: string,
): Record<string, Record<string, unknown>> {
  const dep: Record<string, Record<string, unknown>> = {};

  // Legacy escape hatch seeds the initial provider's defaults.
  if (providerConfig && Object.keys(providerConfig).length) {
    dep[initialProvider] = { ...providerConfig };
  }

  const spotify: Record<string, unknown> = { ...(dep.spotify ?? {}) };
  if (attrs.spotifyClientId) spotify.clientId = attrs.spotifyClientId;
  if (attrs.spotifyRedirectUri) spotify.redirectUri = attrs.spotifyRedirectUri;
  if (Object.keys(spotify).length) dep.spotify = spotify;

  const youtube: Record<string, unknown> = { ...(dep.youtube ?? {}) };
  if (attrs.youtubeApiKey) youtube.apiKey = attrs.youtubeApiKey;
  if (attrs.youtubeSearchEndpoint) youtube.searchEndpoint = attrs.youtubeSearchEndpoint;
  if (Object.keys(youtube).length) dep.youtube = youtube;

  return dep;
}
