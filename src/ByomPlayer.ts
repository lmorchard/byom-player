import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { Playlist, Track } from './types';
import { renderMarkdownInline } from './markdown';
import { sumDurationMs, formatTotalDuration, formatMonthYear } from './format';
import type {
  AudioProvider,
  AvailabilityStatus,
  ProviderState,
  AuthState,
} from './providers/types';
import { loadManifest } from './manifest';
import { PlaybackController } from './controller';
import { createProvider } from './providers/registry';
import { sweepAvailability } from './availability';
import { loadSettings, saveSettings, effectiveProviderConfig, type UserSettings } from './settings';
import {
  parseProviderList,
  parsePlaylistChildren,
  buildDeploymentConfig,
  type PlaylistEntry,
} from './hostConfig';

type ProviderFactory = (name: string, config: Record<string, unknown>) => AudioProvider;

// Built-in themes offered in the Appearance picker. '' = Auto (follow OS).
// Each named value matches a :host([theme='...']) palette block in `static styles`.
const THEMES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto' },
  { value: 'daylight', label: 'Daylight' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'paper', label: 'Paper' },
  { value: 'dracula', label: 'Dracula' },
];

// Per-provider credential fields the settings panel renders + reads back.
// `advanced` fields are tucked into a collapsible <details>. Providers absent
// here (mock/youtube/spotify) need no user-entered credentials.
interface ProviderField {
  key: string;
  label: string;
  type?: string;
  advanced?: boolean;
}
const PROVIDER_FIELDS: Record<string, ProviderField[]> = {
  subsonic: [
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'apiKey', label: 'API key', advanced: true },
  ],
  plex: [
    { key: 'baseUrl', label: 'Base URL', advanced: true },
    { key: 'token', label: 'X-Plex-Token', advanced: true },
  ],
  jellyfin: [
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'token', label: 'API token', advanced: true },
    { key: 'userId', label: 'User ID', advanced: true },
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
  /** Selected named theme; '' = Auto (follow OS via prefers-color-scheme). */
  @property({ reflect: true }) theme = '';
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
  @state() private playlists: PlaylistEntry[] = [];
  @state() private view: 'list' | 'settings' = 'list';
  @state() private draft: UserSettings = { providers: {} };
  @state() private authState: AuthState | null = null;
  @state() private filterQuery = '';
  private settings: UserSettings = { providers: {} };
  private deployment: Record<string, Record<string, unknown>> = {};

  private controller: PlaybackController | null = null;
  private activeProvider: AudioProvider | null = null;
  private sweepAbort: AbortController | null = null;
  private seeking = false; // user is dragging the progress bar
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private commitDelayMs = 600; // debounce before auto-applying a field edit

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    document.addEventListener('keydown', this.onGlobalKeydown);
    this.settings = loadSettings();
    // Persisted theme wins over the host default (mirrors the provider rule).
    if (this.settings.theme) this.theme = this.settings.theme;
    this.playlists = parsePlaylistChildren(this);
    // Multiple playlists: the first is the initial src unless the host set one.
    if (this.playlists.length && !this.src) this.src = this.playlists[0].src;
    // Persisted user selection wins over the host's default `provider`.
    if (this.settings.provider) this.provider = this.settings.provider;
    this.deployment = buildDeploymentConfig(
      {
        spotifyClientId: this.spotifyClientId || undefined,
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
      theme: this.theme,
      providers: structuredClone(this.settings.providers),
    };
    this.view = 'settings';
  }

  private closeSettings(): void {
    this.flushCommit(); // commit any pending debounced field edit before closing
    this.view = 'list';
  }

  private async refreshAvailability(): Promise<void> {
    try {
      localStorage.removeItem('byom-player:resolv:v1');
    } catch {
      // ignore storage errors
    }
    await this.initProvider();
  }

  private onDraftDebug(e: Event): void {
    this.draft = { ...this.draft, debug: (e.currentTarget as HTMLInputElement).checked };
    void this.commitSettings(); // a toggle commits immediately
  }

  private onDraftTheme(e: Event): void {
    this.draft = { ...this.draft, theme: (e.currentTarget as HTMLSelectElement).value };
    void this.commitSettings(); // theme applies immediately, like provider
  }

  // Run an interactive-auth action on the active provider (Connect/Link/etc.).
  // The provider fires onAuthChange, which refreshes this.authState → re-render.
  private async runAuth(id: string): Promise<void> {
    await this.activeProvider?.runAuthAction?.(id);
  }

  // Selecting a provider commits immediately so its connection UI (Spotify
  // Connect, Plex Link) appears inline without waiting for a debounce.
  private async onDraftProvider(e: Event): Promise<void> {
    this.draft = { ...this.draft, provider: (e.currentTarget as HTMLSelectElement).value };
    await this.commitSettings();
  }

  // Credential edits auto-commit after a short debounce — there is no Apply
  // button; the settings apply live.
  private onDraftField(provider: string, key: string, e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    const providers = {
      ...this.draft.providers,
      [provider]: { ...this.draft.providers[provider], [key]: value },
    };
    this.draft = { ...this.draft, providers };
    this.scheduleCommit();
  }

  private scheduleCommit(): void {
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => {
      this.commitTimer = null;
      void this.commitSettings();
    }, this.commitDelayMs);
  }

  private flushCommit(): void {
    if (!this.commitTimer) return;
    clearTimeout(this.commitTimer);
    this.commitTimer = null;
    void this.commitSettings();
  }

  // Persist the draft as the active settings and re-initialize the provider in
  // place. Does NOT close the panel — settings apply live.
  private async commitSettings(): Promise<void> {
    this.settings = {
      provider: this.draft.provider,
      debug: this.draft.debug,
      theme: this.draft.theme,
      providers: this.draft.providers,
    };
    saveSettings(this.settings);
    this.debug = this.settings.debug ?? false;
    this.theme = this.draft.theme ?? '';
    if (this.draft.provider) this.provider = this.draft.provider;
    this.dispatchEvent(
      new CustomEvent('settingschange', { detail: this.settings, bubbles: true, composed: true }),
    );
    await this.initProvider();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.onGlobalKeydown);
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = null;
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

    // Clear the shared video region so a previous provider's embed doesn't linger
    // under the new one. (Auth is now rendered declaratively — no shared slot.)
    await this.updateComplete;
    this.renderRoot.querySelector('.video')?.replaceChildren();

    // Switch away from the previous provider up front so a construction/init
    // failure (e.g. Subsonic with no baseUrl yet) never leaves the old provider
    // active or shows its stale auth UI.
    this.activeProvider = null;
    this.authState = null;

    const factory = this.providerFactory ?? createProvider;
    let prov: AudioProvider;
    try {
      prov = factory(this.provider, this.buildEffectiveConfig());
    } catch (err) {
      // Some providers validate required config in their constructor (Subsonic
      // needs a baseUrl). Surface an error and stop; the user can fix config in
      // the settings panel and re-apply.
      if (this.debug) console.debug('[byom-player] provider construction failed', err);
      this.playbackState = 'error';
      return;
    }
    // Reflect the new provider's auth state and react to changes. The
    // active-provider guard means a disposed provider firing a late onAuthChange
    // is ignored (no shared-slot races).
    this.activeProvider = prov;
    if (prov.getAuthState) {
      prov.onAuthChange?.(() => {
        if (this.activeProvider === prov) this.authState = prov.getAuthState?.() ?? null;
      });
      this.authState = prov.getAuthState();
    } else {
      this.authState = null;
    }
    if (prov.attach) {
      // Ensure the .video region is rendered, then let the provider mount into it.
      // The .stage flex + .video:empty handle showing/hiding it — no flag needed.
      await this.updateComplete;
      const host = this.renderRoot.querySelector('.video');
      if (host) prov.attach(host as HTMLElement);
    }
    try {
      await prov.initialize();
    } catch (err) {
      if (this.debug) console.debug('[byom-player] provider initialize failed', err);
      this.playbackState = 'error';
    }
    // Refresh the snapshot in case initialize() changed auth state without firing.
    if (prov.getAuthState) this.authState = prov.getAuthState();
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

  // The active row's number is the play/pause control, so clicking it toggles
  // playback instead of restarting; any other row selects + plays.
  private onRowClick(index: number): void {
    if (index === this.currentIndex) this.togglePlay();
    else this.selectTrack(index);
  }

  // "{n} tracks · {total duration} · {creation date}", each part conditional.
  private renderMetaLine(pl: Playlist) {
    const parts: string[] = [`${pl.tracks.length} ${pl.tracks.length === 1 ? 'track' : 'tracks'}`];
    const total = sumDurationMs(pl.tracks);
    if (total != null) parts.push(formatTotalDuration(total));
    const date = formatMonthYear(pl.dateCreated);
    if (date) parts.push(date);
    return html`<p class="meta-line" part="meta-line">${parts.join(' · ')}</p>`;
  }

  private async onPlaylistChange(e: Event): Promise<void> {
    const src = (e.currentTarget as HTMLSelectElement).value;
    if (src === this.src) return;
    this.src = src;
    if (await this.loadPlaylist()) await this.initProvider();
  }

  // Case-insensitive substring match against title, artist, and album. An empty
  // query matches everything.
  private matchesFilter(t: Track): boolean {
    const q = this.filterQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album?.toLowerCase().includes(q) ?? false)
    );
  }

  private onFilterInput(e: Event): void {
    this.filterQuery = (e.currentTarget as HTMLInputElement).value;
  }

  private clearFilter(): void {
    this.filterQuery = '';
    this.renderRoot.querySelector<HTMLInputElement>('.filter-input')?.focus();
  }

  private onFilterKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.filterQuery = '';
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  // The deepest focused element, piercing shadow roots — focus inside a shadow
  // tree surfaces as the host element in document.activeElement.
  private deepActiveElement(): Element | null {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }

  private isEditable(el: Element | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
  }

  // Global '/' focuses the filter, unless: it's part of a modifier combo, the
  // settings modal is open (the filter is hidden behind the overlay), or the
  // user is already typing in a field (including our own filter input — there
  // '/' types normally).
  private onGlobalKeydown = (e: KeyboardEvent): void => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.view !== 'list') return;
    if (this.isEditable(this.deepActiveElement())) return;
    e.preventDefault();
    this.renderRoot.querySelector<HTMLInputElement>('.filter-input')?.focus();
  };

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

  // The single dominant state for the track part's `data-state` attribute.
  // active dominates (a playing row reads as active even if orphaned), then
  // unavailable, orphan, pending — mirroring the visual precedence.
  private trackState(index: number, orphaned: boolean): string {
    const unavailable = this.failed.has(index) || this.availability.get(index) === 'unavailable';
    const pending = this.scanning && !this.availability.has(index) && !this.failed.has(index);
    if (index === this.currentIndex) return 'active';
    if (unavailable) return 'unavailable';
    if (orphaned) return 'orphan';
    if (pending) return 'pending';
    return '';
  }

  render() {
    const pl = this.playlist;
    if (!pl) return html`<div class="loading">Loading…</div>`;
    // Derived, filtered view — never mutates pl.tracks or playback indices. Each
    // row carries its real pl.tracks index so selection maps back correctly.
    const q = this.filterQuery.trim();
    const rows = pl.tracks.map((t, i) => ({ t, i })).filter(({ t }) => this.matchesFilter(t));
    const playing = this.playbackState === 'playing';
    return html`
      <div class="corner">
        ${
          this.noSettings
            ? nothing
            : html`<button
                class="gear"
                part="control gear"
                @click=${this.openSettings}
                aria-label="Settings"
                title="Settings"
              >
                ⚙
              </button>`
        }
      </div>
      <div class="head" part="header">
        <div class="art" part="art">🎵</div>
        <div class="meta" part="meta">
          ${
            this.playlists.length > 1
              ? html`<select
                  class="title-select"
                  part="title"
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
              : html`<h2 class="title" part="title">${pl.title}</h2>`
          }
          ${pl.creator ? html`<p class="creator" part="creator">${pl.creator}</p>` : nothing}
          ${this.renderMetaLine(pl)}
          ${
            pl.annotation
              ? html`<div class="description" part="description">
                  ${unsafeHTML(renderMarkdownInline(pl.annotation))}
                </div>`
              : nothing
          }
        </div>
      </div>
      <div class="transport" part="transport">
        <div class="ctl-group">
          <button class="prev" part="control prev" @click=${this.prev} aria-label="Previous">
            ⏮
          </button>
          <button
            class="playpause"
            part="control play"
            @click=${this.togglePlay}
            aria-label="Play/Pause"
          >
            ${playing ? '⏸' : '▶'}
          </button>
          <button class="next" part="control next" @click=${this.next} aria-label="Next">⏭</button>
        </div>
        <div class="seek" part="progress">
          <span class="time">${ByomPlayer.formatTime(this.positionMs)}</span>
          <input
            class="progress"
            part="seek"
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
        <button
          class="shuffle ${this.shuffle ? 'on' : ''}"
          part="control shuffle"
          @click=${this.toggleShuffle}
          aria-label="Shuffle"
          aria-pressed=${this.shuffle ? 'true' : 'false'}
          title=${this.shuffle ? 'Shuffle: on' : 'Shuffle: off'}
        >
          🔀
        </button>
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
      <div class="filter-row" part="filter">
        <input
          class="filter-input"
          part="filter-input"
          type="text"
          placeholder="Filter tracks…"
          .value=${this.filterQuery}
          aria-label="Filter tracks"
          @input=${this.onFilterInput}
          @keydown=${this.onFilterKeydown}
        />
        ${
          this.filterQuery
            ? html`<button
                class="filter-clear"
                part="filter-clear"
                @click=${this.clearFilter}
                aria-label="Clear filter"
              >
                ×
              </button>`
            : nothing
        }
      </div>
      <div class="stage" part="stage">
        <div class="tracklist-empty">
          ${rows.length === 0 && q ? html`<p class="no-matches">No tracks match "${q}"</p>` : nothing}
        </div>
        <ol class="tracklist" part="tracklist">
          ${rows.map(({ t, i }) => {
            const orphaned = t.syncState?.spotifyPresent === false;
            const state = this.trackState(i, orphaned);
            // The active row's glyph mirrors playback; any other row offers play.
            const glyph = state === 'active' ? (playing ? '⏸' : '▶') : '▶';
            return html`
              <li
                class=${this.trackClasses(i, orphaned)}
                part="track"
                data-state=${state}
                @click=${() => this.onRowClick(i)}
              >
                <span class="num" part="track-number">
                  <span class="idx">${state === 'pending' ? '⋯' : i + 1}</span>
                  <span class="glyph">${glyph}</span>
                </span>
                <span class="cell">
                  <span class="t-title">${t.title}</span>
                  <span class="t-artist">${t.artist}</span>
                </span>
                <span class="dur"
                  >${
                    state === 'unavailable'
                      ? '✕'
                      : t.durationMs
                        ? ByomPlayer.formatTime(t.durationMs)
                        : ''
                  }</span
                >
              </li>
            `;
          })}
        </ol>
        <div class="video" part="video"></div>
      </div>
      <div class="settings-overlay" ?hidden=${this.view === 'list'} @click=${this.onOverlayClick}>
        ${this.renderSettings()}
      </div>
    `;
  }

  // Close when the backdrop (not the settings card) is clicked.
  private onOverlayClick(e: Event): void {
    if ((e.target as HTMLElement).classList.contains('settings-overlay')) this.closeSettings();
  }

  private renderField(provider: string, f: ProviderField) {
    return html`<label class="field">
      <span>${f.label}</span>
      <input
        name=${f.key}
        type=${f.type ?? 'text'}
        autocomplete="off"
        .value=${this.draft.providers[provider]?.[f.key] ?? ''}
        @input=${(e: Event) => this.onDraftField(provider, f.key, e)}
      />
    </label>`;
  }

  private renderSettings() {
    const provider = this.draft.provider ?? this.provider;
    const fields = PROVIDER_FIELDS[provider] ?? [];
    const primary = fields.filter((f) => !f.advanced);
    const advanced = fields.filter((f) => f.advanced);
    return html`
      <div
        class="settings ${this.view === 'settings' ? 'open' : ''}"
        part="settings"
        role="dialog"
        aria-modal="true"
      >
        <div class="settings-head">
          <button class="settings-back" @click=${this.closeSettings} aria-label="Back">←</button>
          <span class="settings-title">Settings</span>
        </div>
        <label class="field">
          <span>Appearance</span>
          <select
            class="theme-select"
            .value=${this.draft.theme ?? ''}
            @change=${this.onDraftTheme}
          >
            ${THEMES.map(
              (t) =>
                html`<option value=${t.value} ?selected=${t.value === (this.draft.theme ?? '')}>
                  ${t.label}
                </option>`,
            )}
          </select>
        </label>
        <label class="field">
          <span>Provider</span>
          <select class="provider-select" .value=${provider} @change=${this.onDraftProvider}>
            ${this.allowedProviders.map((p) => html`<option value=${p} ?selected=${p === provider}>${p}</option>`)}
          </select>
        </label>
        ${
          primary.length
            ? html`<div class="provider-fields">
                ${primary.map((f) => this.renderField(provider, f))}
              </div>`
            : nothing
        }
        ${
          this.authState && this.authState.actions.length
            ? html`<div class="settings-connection">
                <span class="settings-label">Connection</span>
                ${
                  this.authState.status
                    ? html`<span class="auth-status">${this.authState.status}</span>`
                    : nothing
                }
                <div class="auth-actions">
                  ${this.authState.actions.map(
                    (a) =>
                      html`<button
                        class="auth-btn"
                        ?disabled=${this.authState?.busy}
                        @click=${() => this.runAuth(a.id)}
                      >
                        ${a.label}
                      </button>`,
                  )}
                </div>
              </div>`
            : nothing
        }
        <div class="settings-actions">
          <button class="refresh" @click=${this.refreshAvailability}>Refresh availability</button>
        </div>
        <details class="advanced">
          <summary>Advanced</summary>
          ${advanced.map((f) => this.renderField(provider, f))}
          <label class="field debug-field">
            <input
              class="debug-toggle"
              type="checkbox"
              .checked=${this.draft.debug ?? false}
              @change=${this.onDraftDebug}
            />
            <span>Debug diagnostics</span>
          </label>
        </details>
      </div>
    `;
  }

  static styles = css`
    :host {
      /* Token vocabulary (the theme contract). Defaults below are the Auto
         light palette; @media dark supplies the Auto dark palette; named
         themes (:host([theme])) override both. Host inline --byom-* wins. */
      --byom-bg: #f7f7f5;
      --byom-surface: #ffffff;
      --byom-text: #1a1a1a;
      --byom-text-muted: #6b6b6b;
      --byom-accent: #3b5bdb;
      --byom-on-accent: #ffffff;
      --byom-border: #d9d9d6;
      --byom-font: system-ui, sans-serif;
      --byom-border-radius: 8px;

      display: block;
      background: var(--byom-bg);
      color: var(--byom-text);
      font-family: var(--byom-font);
      border-radius: var(--byom-border-radius);
      padding: 1rem;
      position: relative; /* anchor for the settings modal overlay */
    }
    /* Auto dark default = Midnight */
    @media (prefers-color-scheme: dark) {
      :host {
        --byom-bg: #1e1e1e;
        --byom-surface: #2a2a2a;
        --byom-text: #ffffff;
        --byom-text-muted: #a0a0a0;
        --byom-accent: #ff0055;
        --byom-on-accent: #14141a;
        --byom-border: #3a3a3a;
      }
    }
    :host([theme='daylight']) {
      --byom-bg: #f7f7f5;
      --byom-surface: #ffffff;
      --byom-text: #1a1a1a;
      --byom-text-muted: #6b6b6b;
      --byom-accent: #3b5bdb;
      --byom-on-accent: #ffffff;
      --byom-border: #d9d9d6;
    }
    :host([theme='midnight']) {
      --byom-bg: #1e1e1e;
      --byom-surface: #2a2a2a;
      --byom-text: #ffffff;
      --byom-text-muted: #a0a0a0;
      --byom-accent: #ff0055;
      --byom-on-accent: #14141a;
      --byom-border: #3a3a3a;
    }
    :host([theme='terminal']) {
      --byom-bg: #0b0f0b;
      --byom-surface: #121812;
      --byom-text: #c8f7c8;
      --byom-text-muted: #5a8a5a;
      --byom-accent: #39ff14;
      --byom-on-accent: #06120a;
      --byom-border: #1f3a1f;
    }
    :host([theme='sunset']) {
      --byom-bg: #241a17;
      --byom-surface: #2f221d;
      --byom-text: #f5e6dc;
      --byom-text-muted: #b08d7d;
      --byom-accent: #ff8c42;
      --byom-on-accent: #241a17;
      --byom-border: #4a352c;
    }
    :host([theme='paper']) {
      --byom-bg: #f4ecd8;
      --byom-surface: #fffaf0;
      --byom-text: #3a2f26;
      --byom-text-muted: #8a7a66;
      --byom-accent: #0f766e;
      --byom-on-accent: #fffaf0;
      --byom-border: #ddd0b8;
    }
    /* Stretch: Dracula */
    :host([theme='dracula']) {
      --byom-bg: #282a36;
      --byom-surface: #343746;
      --byom-text: #f8f8f2;
      --byom-text-muted: #6272a4;
      --byom-accent: #bd93f9;
      --byom-on-accent: #282a36;
      --byom-border: #44475a;
    }
    .playlist-picker {
      margin: 0.25rem 0 0.5rem;
      background: var(--byom-bg);
      color: var(--byom-text);
      border: 1px solid var(--byom-border);
      border-radius: calc(var(--byom-border-radius) / 2);
      padding: 0.25rem 0.4rem;
      font: inherit;
    }
    .now-playing {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      min-height: 1.4rem;
    }
    .now-playing .np-title {
      font-weight: 600;
    }
    .now-playing .np-artist {
      color: var(--byom-text-muted);
      font-size: 0.9rem;
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
      color: var(--byom-text-muted);
    }
    /* Content-driven stage with a cap: short playlists stay compact (no void),
       long ones scroll inside the tracklist, and a mounted 16:9 embed still
       reserves its space while the tracklist flexes into the remainder. */
    .stage {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 60vh;
      margin-top: 0.5rem;
    }
    .video {
      flex: 0 0 auto;
      aspect-ratio: 16 / 9;
      background: var(--byom-surface);
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
      gap: 0.35rem;
      margin: 0.25rem 0;
    }
    .controls button {
      cursor: pointer;
      font-size: 1.3rem;
      line-height: 1;
      color: var(--byom-text);
      background: transparent;
      border: none;
      border-radius: 999px;
      min-width: 2.4rem;
      min-height: 2.4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .controls button:hover {
      background: color-mix(in srgb, var(--byom-text) 10%, transparent);
    }
    .controls .playpause {
      font-size: 1.7rem;
      color: var(--byom-on-accent);
      background: var(--byom-accent);
    }
    .controls .playpause:hover {
      background: var(--byom-accent);
      filter: brightness(1.08);
    }
    .controls .shuffle {
      border: 1px solid var(--byom-border);
      border-radius: 999px;
      background: transparent;
      color: var(--byom-text);
      padding: 0.3rem 0.9rem;
      font-size: 1rem;
      opacity: 0.8;
    }
    .controls .shuffle.on {
      background: var(--byom-accent);
      color: var(--byom-on-accent);
      opacity: 1;
    }
    .filter-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.5rem 0;
    }
    .filter-row .filter-input {
      flex: 1;
      background: var(--byom-surface);
      color: var(--byom-text);
      border: 1px solid var(--byom-border);
      border-radius: 999px;
      padding: 0.3rem 0.8rem;
      font: inherit;
      font-size: 0.9rem;
    }
    .filter-row .filter-input:focus {
      outline: none;
      border-color: var(--byom-accent);
    }
    .filter-row .filter-clear {
      cursor: pointer;
      background: transparent;
      border: none;
      color: var(--byom-text-muted);
      font-size: 1.2rem;
      line-height: 1;
      padding: 0 0.3rem;
    }
    .filter-row .filter-clear:hover {
      color: var(--byom-text);
    }
    .no-matches {
      color: var(--byom-text-muted);
      font-size: 0.85rem;
      padding: 0.5rem;
      margin: 0;
    }
    .tracklist {
      list-style: none;
      margin: 0;
      padding: 0;
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
    .tracklist li {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.3rem 0.5rem 0.3rem 0.75rem;
      border-left: 3px solid transparent; /* reserve the active bar's width */
      border-radius: calc(var(--byom-border-radius) / 2);
    }
    .tracklist li:hover {
      background: color-mix(in srgb, var(--byom-text) 8%, transparent);
    }
    .tracklist li.active {
      color: var(--byom-accent);
      font-weight: 600;
      border-left-color: var(--byom-accent);
      background: color-mix(in srgb, var(--byom-accent) 12%, transparent);
    }
    .tracklist li.orphan {
      color: var(--byom-text-muted);
    }
    .tracklist li.orphan .t-title::after {
      content: '↯';
      margin-left: 0.4rem;
      opacity: 0.8;
      font-size: 0.85em;
    }
    .tracklist li.unavailable {
      color: var(--byom-text-muted);
      text-decoration: line-through;
    }
    .tracklist li.unavailable .t-title::after {
      content: '✕';
      margin-left: 0.4rem;
      text-decoration: none;
      opacity: 0.7;
    }
    .tracklist li.pending {
      color: var(--byom-text-muted);
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
      font-size: 1.8rem;
      line-height: 1;
      padding: 0.1rem 0.3rem;
      opacity: 0.75;
      cursor: pointer;
    }
    .controls .gear:hover {
      opacity: 1;
    }
    /* Modal overlay: covers the player + blocks interaction with it while open. */
    .settings-overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.6);
      border-radius: var(--byom-border-radius);
    }
    .settings {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
      max-width: 22rem;
      /* Height is decoupled from the (now content-driven) stage: a comfortable
         min so it doesn't collapse for sparse providers, capped so it never
         outgrows the component; content scrolls past the cap. */
      min-height: 16rem;
      max-height: min(80%, 32rem);
      overflow: auto;
      background: var(--byom-surface);
      border: 1px solid var(--byom-border);
      border-radius: var(--byom-border-radius);
      padding: 1.25rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
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
      border: 1px solid var(--byom-border);
      border-radius: calc(var(--byom-border-radius) / 2);
      padding: 0.3rem;
      font: inherit;
    }
    .settings .field input:focus,
    .settings .field select:focus {
      border-color: var(--byom-accent);
      outline: none;
    }
    .settings .apply {
      align-self: flex-start;
      background: var(--byom-accent);
      color: var(--byom-on-accent);
      border: none;
      border-radius: 999px;
      padding: 0.4rem 1rem;
      cursor: pointer;
      font-weight: bold;
    }
    .advanced {
      font-size: 0.8rem;
    }
    .advanced summary {
      cursor: pointer;
      opacity: 0.6;
      padding: 0.2rem 0;
    }
    .advanced > .field {
      margin-top: 0.4rem;
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
    .auth-status {
      font-size: 0.8rem;
      opacity: 0.85;
    }
    .auth-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .auth-btn {
      cursor: pointer;
      background: var(--byom-accent);
      color: var(--byom-on-accent);
      border: none;
      border-radius: 999px;
      padding: 0.35rem 0.9rem;
      font: inherit;
    }
    .auth-btn[disabled] {
      opacity: 0.5;
      cursor: default;
    }
    .settings-actions {
      display: grid;
      gap: 0.5rem;
    }
    .debug-field {
      grid-auto-flow: column;
      justify-content: start;
      align-items: center;
      gap: 0.4rem;
    }
    .refresh {
      justify-self: start;
      background: transparent;
      color: var(--byom-text);
      border: 1px solid var(--byom-accent);
      border-radius: 999px;
      padding: 0.3rem 0.9rem;
      cursor: pointer;
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
