import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Playlist } from './types';
import type { AudioProvider, AvailabilityStatus, ProviderState } from './providers/types';
import { loadManifest } from './manifest';
import { PlaybackController } from './controller';
import { createProvider } from './providers/registry';
import { sweepAvailability } from './availability';
import { loadSettings, saveSettings, effectiveProviderConfig, type UserSettings } from './settings';
import {
  parseProviderList,
  parsePlaylistChildren,
  buildDeploymentConfig,
  DEFAULT_SPOTIFY_CLIENT_ID,
  type PlaylistEntry,
} from './hostConfig';

type ProviderFactory = (name: string, config: Record<string, unknown>) => AudioProvider;

// Per-provider credential fields the settings panel renders + reads back.
// Providers absent here (mock/youtube/spotify) need no user-entered credentials.
const PROVIDER_FIELDS: Record<string, { key: string; label: string; type?: string }[]> = {
  subsonic: [
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'apiKey', label: 'API key' },
  ],
  plex: [
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'token', label: 'X-Plex-Token' },
  ],
  jellyfin: [
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'token', label: 'API token' },
    { key: 'userId', label: 'User ID' },
  ],
  youtube: [],
  spotify: [],
  mock: [],
};

@customElement('byom-player')
export class ByomPlayer extends LitElement {
  /** URL to the JSPF manifest. */
  @property() src = '';
  /** Which audio provider to use ('mock' | 'subsonic'). */
  @property() provider = 'mock';
  /** Provider-specific configuration (e.g. Navidrome credentials). */
  @property({ attribute: false }) providerConfig: Record<string, unknown> = {};
  /** Optional override for provider construction (host-supplied custom providers / tests). */
  @property({ attribute: false }) providerFactory?: ProviderFactory;
  /** Delay (ms) between auto-skips when tracks fail to resolve, to avoid hammering the server. */
  @property({ type: Number }) skipDelayMs = 400;
  /** Emit console.debug diagnostics from the provider + controller. */
  @property({ type: Boolean }) debug = false;
  /** Gently pre-check each track's availability in the background after load. */
  @property({ type: Boolean }) prescan = true;
  /** Delay (ms) between background availability checks. */
  @property({ type: Number }) prescanDelayMs = 300;
  /** Comma-separated allowlist of selectable providers (defaults to all). */
  @property() providers = '';
  /** Hide the in-component settings gear/panel. */
  @property({ type: Boolean, attribute: 'no-settings' }) noSettings = false;
  /** Deployment default: Spotify client id (host-set, not user-editable). */
  @property({ attribute: 'spotify-client-id' }) spotifyClientId = '';
  /** Deployment default: Spotify redirect URI. */
  @property({ attribute: 'spotify-redirect-uri' }) spotifyRedirectUri = '';
  /** Deployment default: YouTube Data API key. */
  @property({ attribute: 'youtube-api-key' }) youtubeApiKey = '';
  /** Deployment default: YouTube search-proxy endpoint. */
  @property({ attribute: 'youtube-search-endpoint' }) youtubeSearchEndpoint = '';

  @state() private playlist: Playlist | null = null;
  @state() private currentIndex = 0;
  @state() private playbackState: ProviderState = 'uninitialized';
  @state() private failed = new Set<number>();
  @state() private halted = false;
  @state() private shuffle = false;
  @state() private availability = new Map<number, AvailabilityStatus>();
  @state() private scanning = false;
  @state() private positionMs = 0;
  @state() private durationMs = 0;
  @state() private hasVideo = false;
  @state() private playlists: PlaylistEntry[] = [];
  @state() private view: 'list' | 'settings' = 'list';
  @state() private draft: UserSettings = { providers: {} };
  private settings: UserSettings = { providers: {} };
  private deployment: Record<string, Record<string, unknown>> = {};

  private controller: PlaybackController | null = null;
  private activeProvider: AudioProvider | null = null;
  private sweepAbort: AbortController | null = null;
  private seeking = false; // user is dragging the progress bar

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.settings = loadSettings();
    this.playlists = parsePlaylistChildren(this);
    // Multiple playlists: the first is the initial src unless the host set one.
    if (this.playlists.length && !this.src) this.src = this.playlists[0].src;
    // Persisted user selection wins over the host's default `provider`.
    if (this.settings.provider) this.provider = this.settings.provider;
    this.deployment = buildDeploymentConfig(
      {
        spotifyClientId: this.spotifyClientId || DEFAULT_SPOTIFY_CLIENT_ID || undefined,
        spotifyRedirectUri: this.spotifyRedirectUri || undefined,
        youtubeApiKey: this.youtubeApiKey || undefined,
        youtubeSearchEndpoint: this.youtubeSearchEndpoint || undefined,
      },
      this.providerConfig,
      this.provider,
    );
    await this.loadAndInit();
  }

  // The set of providers the user may select in the panel.
  private get allowedProviders(): string[] {
    return parseProviderList(this.providers || null);
  }

  private openSettings(): void {
    // Deep-copy current settings into a draft the form mutates.
    this.draft = {
      provider: this.provider,
      debug: this.debug,
      providers: structuredClone(this.settings.providers),
    };
    this.view = 'settings';
  }

  private closeSettings(): void {
    this.view = 'list';
  }

  private onDraftProvider(e: Event): void {
    this.draft = { ...this.draft, provider: (e.currentTarget as HTMLSelectElement).value };
  }

  private onDraftField(provider: string, key: string, e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    const providers = {
      ...this.draft.providers,
      [provider]: { ...this.draft.providers[provider], [key]: value },
    };
    this.draft = { ...this.draft, providers };
  }

  private async applySettings(): Promise<void> {
    this.settings = {
      provider: this.draft.provider,
      debug: this.draft.debug,
      providers: this.draft.providers,
    };
    saveSettings(this.settings);
    if (this.draft.provider) this.provider = this.draft.provider;
    this.dispatchEvent(
      new CustomEvent('settingschange', { detail: this.settings, bubbles: true, composed: true }),
    );
    this.view = 'list';
    await this.initProvider();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.sweepAbort?.abort();
    this.sweepAbort = null;
    this.controller?.dispose();
    this.controller = null;
  }

  // On a provider session change (link/unlink), drop stale availability: un-mark
  // the controller's skip-set, clear the displayed marks, then re-scan against
  // the new session (unlinked → quick 'unknown's; relinked → fresh results).
  private handleProviderReset(): void {
    for (const [i, status] of this.availability) {
      if (status === 'unavailable') this.controller?.markUnavailable(i, false);
    }
    this.availability = new Map();
    this.failed = new Set();
    this.startSweep(); // aborts any in-flight sweep, then re-scans
  }

  private async loadAndInit(): Promise<void> {
    if (!this.src) return;
    if (!(await this.loadPlaylist())) return;
    await this.initProvider();
  }

  // Fetch + parse the manifest at this.src. Returns false (and flags error) on
  // failure. Split out so a playlist switch can reload without touching the
  // provider, and a provider switch can re-init without refetching.
  private async loadPlaylist(): Promise<boolean> {
    this.sweepAbort?.abort();
    this.availability = new Map();
    this.hasVideo = false;
    try {
      const res = await fetch(this.src);
      this.playlist = loadManifest(await res.json());
      return true;
    } catch {
      this.playbackState = 'error';
      return false;
    }
  }

  // Effective provider config. Extended in later tasks to merge deployment
  // defaults + user settings; for now preserves the pre-panel behavior.
  private buildEffectiveConfig(): Record<string, unknown> {
    const cfg = effectiveProviderConfig(this.provider, this.deployment, this.settings);
    return this.debug ? { ...cfg, debug: true } : cfg;
  }

  // Build + initialize the active provider, wire the controller, start the
  // sweep. Disposes any existing provider/controller first so this is safe to
  // call on a settings change (no element remount).
  private async initProvider(): Promise<void> {
    if (!this.playlist) return;
    this.sweepAbort?.abort();
    this.controller?.dispose();
    this.controller = null;
    this.availability = new Map();
    this.failed = new Set();
    this.hasVideo = false; // reset; re-set below only if the new provider attaches

    const factory = this.providerFactory ?? createProvider;
    const prov = factory(this.provider, this.buildEffectiveConfig());
    if (prov.attach) {
      // Ensure the .video region is rendered, then let the provider mount into it.
      await this.updateComplete;
      const host = this.renderRoot.querySelector('.video');
      if (host) {
        prov.attach(host as HTMLElement);
        this.hasVideo = true; // reserve space + shorten the tracklist
      }
    }
    if (prov.attachAuth) {
      // The .settings container is always rendered (just hidden in list view),
      // so the auth slot exists for the provider to mount into.
      await this.updateComplete;
      const authHost = this.renderRoot.querySelector('.auth-slot');
      if (authHost) prov.attachAuth(authHost as HTMLElement);
    }
    await prov.initialize();
    this.activeProvider = prov;
    this.controller = new PlaybackController(
      prov,
      this.playlist.tracks,
      () => this.syncFromController(),
      { skipDelayMs: this.skipDelayMs, debug: this.debug },
    );
    // When a provider's session changes (e.g. Plex link/unlink), its cached
    // availability knowledge is stale — clear the marks and re-scan.
    prov.onReset?.(() => this.handleProviderReset());
    this.startSweep();
  }

  // Run the background availability prescan against the active provider. Aborts
  // any sweep already in flight first, so it's safe to call on a session change.
  private startSweep(): void {
    const prov = this.activeProvider;
    if (!prov?.checkAvailability || !this.prescan || !this.playlist) return;
    this.sweepAbort?.abort();
    this.sweepAbort = new AbortController();
    this.scanning = true;
    void sweepAvailability(
      prov,
      this.playlist.tracks,
      (i, status) => {
        this.availability = new Map(this.availability).set(i, status);
        // Let the queue skip known-missing tracks (shuffle + advance).
        if (status === 'unavailable') this.controller?.markUnavailable(i, true);
      },
      { signal: this.sweepAbort.signal, delayMs: this.prescanDelayMs },
    ).finally(() => {
      this.scanning = false;
    });
  }

  private syncFromController(): void {
    if (!this.controller) return;
    this.currentIndex = this.controller.index;
    this.playbackState = this.controller.state;
    this.failed = new Set(this.controller.failed);
    this.halted = this.controller.halted;
    this.shuffle = this.controller.shuffle;
    this.durationMs = this.controller.durationMs;
    // Don't yank the thumb out from under an active drag.
    if (!this.seeking) this.positionMs = this.controller.positionMs;
  }

  updated(changed: PropertyValues): void {
    // Keep the playing track centered in the (scrollable) tracklist as playback
    // moves through the queue.
    if (changed.has('currentIndex')) this.centerActiveTrack();
  }

  // Scroll the tracklist so the active row sits as close to the vertical center
  // as its scroll range allows. Only the list scrolls — never the host page.
  private centerActiveTrack(): void {
    const list = this.renderRoot.querySelector<HTMLElement>('.tracklist');
    const active = list?.querySelector<HTMLElement>('li.active');
    if (!list || !active) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const delta = activeRect.top - listRect.top - (list.clientHeight - active.clientHeight) / 2;
    // Optional-chained: environments without layout (e.g. happy-dom in tests)
    // don't implement scrollBy.
    list.scrollBy?.({ top: delta, behavior: 'smooth' });
  }

  private selectTrack(index: number): void {
    void this.controller?.start(index);
  }

  private async onPlaylistChange(e: Event): Promise<void> {
    const src = (e.currentTarget as HTMLSelectElement).value;
    if (src === this.src) return;
    this.src = src;
    if (await this.loadPlaylist()) await this.initProvider();
  }

  private togglePlay(): void {
    if (this.playbackState === 'playing') this.controller?.pause();
    else void this.controller?.play();
  }

  private next(): void {
    void this.controller?.next();
  }

  private prev(): void {
    void this.controller?.prev();
  }

  private toggleShuffle(): void {
    if (this.controller) this.controller.setShuffle(!this.controller.shuffle);
  }

  private onSeekInput(): void {
    this.seeking = true;
  }

  private onSeekChange(e: Event): void {
    const ms = Number((e.currentTarget as HTMLInputElement).value);
    this.seeking = false;
    this.controller?.seek(ms);
  }

  private static formatTime(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  private trackClasses(index: number, orphaned: boolean): string {
    const unavailable = this.failed.has(index) || this.availability.get(index) === 'unavailable';
    // Not yet reached by the background prescan.
    const pending = this.scanning && !this.availability.has(index) && !this.failed.has(index);
    return [
      index === this.currentIndex ? 'active' : '',
      orphaned ? 'orphan' : '',
      unavailable ? 'unavailable' : '',
      pending ? 'pending' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  render() {
    const pl = this.playlist;
    if (!pl) return html`<div class="loading">Loading…</div>`;
    const current = pl.tracks[this.currentIndex];
    return html`
      <header class="header">
        <h2 class="title">${pl.title}</h2>
        ${pl.creator ? html`<p class="creator">${pl.creator}</p>` : nothing}
      </header>
      <div class="playlist-row">
        ${
          this.playlists.length > 1
            ? html`<select
                class="playlist-picker"
                aria-label="Playlist"
                @change=${this.onPlaylistChange}
              >
                ${this.playlists.map(
                  (p) =>
                    html`<option value=${p.src} ?selected=${p.src === this.src}>
                      ${p.title}
                    </option>`,
                )}
              </select>`
            : nothing
        }
      </div>
      <div class="now-playing">
        ${
          current
            ? html`<span class="np-title">${current.title}</span>
                <span class="np-artist">${current.artist}</span>`
            : nothing
        }
      </div>
      <div class="progress-row">
        <span class="time">${ByomPlayer.formatTime(this.positionMs)}</span>
        <input
          class="progress"
          type="range"
          min="0"
          max=${this.durationMs || 0}
          .value=${String(this.positionMs)}
          ?disabled=${!this.durationMs}
          aria-label="Seek"
          @input=${this.onSeekInput}
          @change=${this.onSeekChange}
        />
        <span class="time">${ByomPlayer.formatTime(this.durationMs)}</span>
      </div>
      <div class="controls">
        <button class="prev" @click=${this.prev} aria-label="Previous">⏮</button>
        <button class="playpause" @click=${this.togglePlay} aria-label="Play/Pause">
          ${this.playbackState === 'playing' ? '⏸' : '▶'}
        </button>
        <button class="next" @click=${this.next} aria-label="Next">⏭</button>
        <button
          class="shuffle ${this.shuffle ? 'on' : ''}"
          @click=${this.toggleShuffle}
          aria-label="Shuffle"
          aria-pressed=${this.shuffle ? 'true' : 'false'}
          title=${this.shuffle ? 'Shuffle: on' : 'Shuffle: off'}
        >
          🔀 ${this.shuffle ? 'On' : 'Off'}
        </button>
        ${
          this.noSettings
            ? nothing
            : html`<button
                class="gear"
                @click=${this.openSettings}
                aria-label="Settings"
                title="Settings"
              >
                ⚙
              </button>`
        }
      </div>
      <div class="status">
        ${
          this.halted
            ? html`<span class="halted"
                >Playback stopped after repeated errors — pick a track to retry.</span
              >`
            : nothing
        }
      </div>
      <ol
        class="tracklist ${this.hasVideo ? 'with-video' : ''}"
        ?hidden=${this.view === 'settings'}
      >
        ${pl.tracks.map((t, i) => {
          const orphaned = t.syncState?.spotifyPresent === false;
          return html`
            <li class=${this.trackClasses(i, orphaned)} @click=${() => this.selectTrack(i)}>
              <span class="t-title">${t.title}</span>
              <span class="t-artist">${t.artist}</span>
            </li>
          `;
        })}
      </ol>
      <div class="settings-host">${this.renderSettings()}</div>
      <div class="video" part="video"></div>
    `;
  }

  private renderSettings() {
    const provider = this.draft.provider ?? this.provider;
    const fields = PROVIDER_FIELDS[provider] ?? [];
    return html`
      <div
        class="settings ${this.view === 'settings' ? 'open' : ''}"
        ?hidden=${this.view === 'list'}
      >
        <div class="settings-head">
          <button class="settings-back" @click=${this.closeSettings} aria-label="Back">←</button>
          <span class="settings-title">Settings</span>
        </div>
        <label class="field">
          <span>Provider</span>
          <select class="provider-select" .value=${provider} @change=${this.onDraftProvider}>
            ${this.allowedProviders.map((p) => html`<option value=${p} ?selected=${p === provider}>${p}</option>`)}
          </select>
        </label>
        <div class="provider-fields">
          ${fields.map(
            (f) =>
              html`<label class="field">
                <span>${f.label}</span>
                <input
                  name=${f.key}
                  type=${f.type ?? 'text'}
                  autocomplete="off"
                  .value=${this.draft.providers[provider]?.[f.key] ?? ''}
                  @input=${(e: Event) => this.onDraftField(provider, f.key, e)}
                />
              </label>`,
          )}
          ${
            fields.length === 0 ? html`<p class="field-note">No configuration needed.</p>` : nothing
          }
        </div>
        <div class="settings-connection">
          <span class="settings-label">Connection</span>
          <div class="auth-slot" part="auth"></div>
        </div>
        <button class="apply" @click=${this.applySettings}>Apply</button>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      --byom-bg: #1e1e1e;
      --byom-text: #ffffff;
      --byom-accent: #ff0055;
      --byom-font: system-ui, sans-serif;
      --byom-border-radius: 8px;

      background: var(--byom-bg);
      color: var(--byom-text);
      font-family: var(--byom-font);
      border-radius: var(--byom-border-radius);
      padding: 1rem;
    }
    .playlist-picker {
      margin: 0.25rem 0 0.5rem;
      background: var(--byom-bg);
      color: var(--byom-text);
      border: 1px solid var(--byom-accent);
      border-radius: calc(var(--byom-border-radius) / 2);
      padding: 0.25rem 0.4rem;
      font: inherit;
    }
    .progress-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.5rem 0;
    }
    .progress-row .progress {
      flex: 1;
      accent-color: var(--byom-accent);
    }
    .progress-row .time {
      font-variant-numeric: tabular-nums;
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .video {
      aspect-ratio: 16 / 9;
      margin-top: 0.5rem;
      background: #000;
      border-radius: calc(var(--byom-border-radius) / 2);
      overflow: hidden;
    }
    .video:empty {
      display: none;
    }
    .video iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .controls button {
      cursor: pointer;
      font-size: 1.4rem;
      line-height: 1;
    }
    .controls .playpause {
      font-size: 2rem;
    }
    .controls .shuffle {
      border: 1px solid var(--byom-accent);
      border-radius: 999px;
      background: transparent;
      color: var(--byom-text);
      padding: 0.3rem 0.9rem;
      font-size: 1rem;
      opacity: 0.6;
    }
    .controls .shuffle.on {
      background: var(--byom-accent);
      color: var(--byom-bg);
      opacity: 1;
    }
    .tracklist {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 60vh;
      overflow: auto;
    }
    .tracklist.with-video {
      max-height: 30vh;
    }
    .tracklist li {
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.25rem 0.5rem;
    }
    .tracklist li.active {
      color: var(--byom-accent);
      font-weight: bold;
    }
    .tracklist li.orphan {
      opacity: 0.55;
    }
    .tracklist li.unavailable {
      text-decoration: line-through;
      opacity: 0.4;
    }
    .tracklist li.pending {
      opacity: 0.5;
    }
    .tracklist li.pending .t-title::before {
      content: '⋯ ';
      color: var(--byom-accent);
    }
    .status .halted {
      color: var(--byom-accent);
      font-size: 0.85rem;
    }
    .controls .gear {
      margin-left: auto;
      background: transparent;
      border: none;
      color: var(--byom-text);
      font-size: 1.2rem;
      opacity: 0.7;
      cursor: pointer;
    }
    .settings {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 60vh;
      overflow: auto;
    }
    .settings-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .settings-back {
      background: transparent;
      border: none;
      color: var(--byom-text);
      cursor: pointer;
      font-size: 1.1rem;
    }
    .settings .field {
      display: grid;
      gap: 0.15rem;
      font-size: 0.8rem;
      opacity: 0.9;
    }
    .settings .field input,
    .settings .field select {
      background: var(--byom-bg);
      color: var(--byom-text);
      border: 1px solid var(--byom-accent);
      border-radius: calc(var(--byom-border-radius) / 2);
      padding: 0.3rem;
      font: inherit;
    }
    .settings .apply {
      align-self: flex-start;
      background: var(--byom-accent);
      color: var(--byom-bg);
      border: none;
      border-radius: 999px;
      padding: 0.4rem 1rem;
      cursor: pointer;
      font-weight: bold;
    }
    .field-note {
      font-size: 0.8rem;
      opacity: 0.6;
    }
    .settings-connection {
      display: grid;
      gap: 0.3rem;
    }
    .settings-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.6;
    }
    .auth-slot {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .auth-slot button {
      cursor: pointer;
      background: var(--byom-accent);
      color: var(--byom-bg);
      border: none;
      border-radius: 999px;
      padding: 0.35rem 0.9rem;
      font: inherit;
    }
    [hidden] {
      display: none !important;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'byom-player': ByomPlayer;
  }
}
