import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import '@lit-labs/virtualizer';
import type { Playlist, Track } from './types';
import { renderMarkdownInline } from './markdown';
import { sumDurationMs, formatTotalDuration, formatDateRange } from './format';
import type {
  AudioProvider,
  AvailabilityStatus,
  ProviderState,
  AuthState,
} from './providers/types';
import { loadManifest } from './manifest';
import { PlaybackController } from './controller';
import { createProvider } from './providers/registry';
import { detectSpotifyPreview } from './providers/spotify/preview';
import { AvailabilityQueue } from './availability';
import { loadSettings, saveSettings, effectiveProviderConfig, type UserSettings } from './settings';
import {
  parseProviderList,
  parsePlaylistChildren,
  buildDeploymentConfig,
  type PlaylistEntry,
} from './hostConfig';

type ProviderFactory = (name: string, config: Record<string, unknown>) => AudioProvider;

// Filled media-control icons (24-unit viewBox, fill: currentColor), sized via
// CSS. Rendered as inline SVG rather than Unicode glyphs (⏸ ▶ ⏮ ⏭) because
// those carry an emoji-presentation default that some platforms (notably iOS)
// render as colored glyphs, ignoring the theme color — a VS15 text-presentation
// selector doesn't reliably override it. SVG + currentColor always inherits the
// theme color. Shared between the transport controls and the active-row glyph.
const MEDIA_ICON = {
  prev: html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 6h2v12H7zM18 6 9.5 12 18 18z" />
  </svg>`,
  next: html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 6 14.5 12 6 18zM15 6h2v12h-2z" />
  </svg>`,
  play: html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>`,
  pause: html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6.5" y="5" width="4" height="14" rx="1" />
    <rect x="13.5" y="5" width="4" height="14" rx="1" />
  </svg>`,
};

// Pure arithmetic behind centerActiveTrack: given the active row's ACTUAL top
// offset within the scroller's scroll space and the scroller's geometry, return
// the scrollTop that centers the row, clamped to the scrollable range. rowTop is
// measured from the rendered element (not predicted from pos * rowHeight) so the
// virtualizer's sub-pixel layout can't accumulate error. Extracted so the math
// is unit-testable without a real layout engine.
export function computeCenterOffset(
  rowTop: number,
  rowH: number,
  clientH: number,
  scrollH: number,
): number {
  const target = rowTop - (clientH - rowH) / 2;
  const max = scrollH - clientH;
  return Math.max(0, Math.min(target, max));
}

// Case-insensitive substring match against title, artist, and album. An empty
// query matches everything.
export function matchesFilter(track: Track, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    track.title.toLowerCase().includes(q) ||
    track.artist.toLowerCase().includes(q) ||
    (track.album?.toLowerCase().includes(q) ?? false)
  );
}

// A track is "orphaned" when byom-sync recorded it as no longer present in its
// Spotify source.
export function isOrphan(track: Track): boolean {
  return track.syncState?.spotifyPresent === false;
}

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
  @state() private checking = new Set<number>();
  @state() private positionMs = 0;
  @state() private durationMs = 0;
  // True when the Spotify embed is playing a 30s preview instead of the full
  // track (see providers/spotify/preview). Drives the transport preview badge.
  @state() private preview = false;
  @state() private playlists: PlaylistEntry[] = [];
  @state() private view: 'list' | 'settings' = 'list';
  // Collapsed by default; only meaningful on narrow players (CSS gates the
  // floating-mini vs. full-width layout). Ephemeral — never persisted.
  @state() private videoExpanded = false;
  // Narrow-player description collapse. Both ephemeral — never persisted.
  @state() private descExpanded = false;
  @state() private descOverflows = false;
  @state() private draft: UserSettings = { providers: {} };
  @state() private authState: AuthState | null = null;
  @state() private filterQuery = '';
  private settings: UserSettings = { providers: {} };
  private deployment: Record<string, Record<string, unknown>> = {};

  private controller: PlaybackController | null = null;
  private activeProvider: AudioProvider | null = null;
  private availQueue: AvailabilityQueue | null = null;
  private seeking = false; // user is dragging the progress bar
  // The virtualizer's most recently reported rendered index range (positions
  // within the filtered rows). Used to seed checks when (re)arming the queue.
  private lastRange: { first: number; last: number } | null = null;
  // Bumped on each centerActiveTrack call so a stale far-jump poll loop from a
  // superseded call (rapid track changes) bails instead of yanking the scroll.
  private centerToken = 0;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private descResizeObserver?: ResizeObserver;
  private commitDelayMs = 600; // debounce before auto-applying a field edit
  // How many tracks past the playing one the availability prescan looks ahead.
  private static readonly AVAIL_LOOKAHEAD = 10;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    document.addEventListener('keydown', this.onGlobalKeydown);
    // Re-evaluate description overflow on width changes (rotation, resize,
    // crossing the 30rem breakpoint). Guarded: happy-dom lacks ResizeObserver.
    // Set up here (not firstUpdated) so it re-establishes if the element is
    // detached and re-attached. Idempotent: only create once per connection.
    if (typeof ResizeObserver !== 'undefined' && !this.descResizeObserver) {
      this.descResizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => this.measureDescOverflow());
      });
      this.descResizeObserver.observe(this);
    }
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
    this.availQueue?.dispose();
    this.availQueue = null;
    this.controller?.dispose();
    this.controller = null;
    this.descResizeObserver?.disconnect();
    this.descResizeObserver = undefined;
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
    this.armAvailabilityQueue(); // disposes any existing queue, then re-arms
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

  // Build + initialize the active provider, wire the controller, arm the
  // availability queue. Disposes any existing provider/controller first so this
  // is safe to call on a settings change (no element remount).
  private async initProvider(): Promise<void> {
    if (!this.playlist) return;
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
    this.armAvailabilityQueue();
  }

  // (Re)create the availability queue for the active provider and seed it with
  // the tracks worth checking right now: a lookahead window around the current
  // track plus whatever the virtualizer last reported as visible. Safe to call
  // on init and on a provider/session reset.
  private armAvailabilityQueue(): void {
    this.availQueue?.dispose();
    this.availQueue = null;
    this.checking = new Set();
    const prov = this.activeProvider;
    if (!prov?.checkAvailability || !this.prescan || !this.playlist) return;
    this.availQueue = new AvailabilityQueue(
      prov,
      this.playlist.tracks,
      (i, status) => this.onAvailabilityResult(i, status),
      { delayMs: this.prescanDelayMs },
    );
    this.syncAvailabilityChecks(); // seed with the current visible + playback window
  }

  private onAvailabilityResult(i: number, status: AvailabilityStatus): void {
    this.availability = new Map(this.availability).set(i, status);
    if (this.checking.has(i)) {
      const next = new Set(this.checking);
      next.delete(i);
      this.checking = next;
    }
    // Let the queue skip known-missing tracks (shuffle + advance).
    if (status === 'unavailable') this.controller?.markUnavailable(i, true);
  }

  // Enqueue real track indices and reflect the newly-accepted ones as in-flight.
  private enqueueChecks(indices: number[]): void {
    const accepted = this.availQueue?.request(indices) ?? [];
    if (!accepted.length) return;
    const next = new Set(this.checking);
    for (const i of accepted) next.add(i);
    this.checking = next;
  }

  // The set of tracks worth checking right now: the visible range plus a small
  // forward lookahead around the playing track (playback advances forward, even
  // when scrolled away).
  private relevantCheckWindow(): Set<number> {
    const keep = new Set<number>();
    if (this.lastRange) {
      const rows = this.filteredRows;
      const first = Math.max(0, this.lastRange.first);
      for (let p = first; p <= this.lastRange.last && p < rows.length; p++) keep.add(rows[p].i);
    }
    for (let i = this.currentIndex; i < this.currentIndex + ByomPlayer.AVAIL_LOOKAHEAD; i++) {
      if (i >= 0) keep.add(i);
    }
    return keep;
  }

  // Focus the availability queue on the currently-relevant window: prune queued
  // checks that have scrolled out of view (so a fast scroll through a
  // search-backed playlist doesn't leave a long tail of live searches for rows
  // you've left), then enqueue the window. Called on init, on range change, and
  // on track change. Visible rows are added before the lookahead, so they're
  // checked first.
  private syncAvailabilityChecks(): void {
    const q = this.availQueue;
    if (!q) return;
    const keep = this.relevantCheckWindow();
    const dropped = q.retain(keep);
    if (dropped.length) {
      const next = new Set(this.checking);
      for (const i of dropped) next.delete(i);
      this.checking = next;
    }
    this.enqueueChecks([...keep]);
  }

  private syncFromController(): void {
    if (!this.controller) return;
    this.currentIndex = this.controller.index;
    this.playbackState = this.controller.state;
    this.failed = new Set(this.controller.failed);
    this.halted = this.controller.halted;
    this.shuffle = this.controller.shuffle;
    this.durationMs = this.controller.durationMs;
    this.preview = detectSpotifyPreview(
      this.provider,
      this.durationMs,
      this.playlist?.tracks[this.currentIndex]?.durationMs ?? 0,
    );
    // Don't yank the thumb out from under an active drag.
    if (!this.seeking) this.positionMs = this.controller.positionMs;
  }

  updated(changed: PropertyValues): void {
    // Keep the playing track centered in the (scrollable) tracklist as playback
    // moves through the queue, and extend the availability lookahead forward.
    if (changed.has('currentIndex')) {
      this.centerActiveTrack();
      this.syncAvailabilityChecks();
    }
    if (changed.has('playlist')) {
      // New annotation: collapse and re-measure once the new DOM settles.
      this.descExpanded = false;
      void this.updateComplete.then(() => this.measureDescOverflow());
    }
  }

  // Scroll the virtualized list so the active row is centered.
  //
  // We identify the target row by its POSITION in the filtered list, not by the
  // rendered `active` class. The <lit-virtualizer> re-renders row content (which
  // row carries `active`) on its own async cycle, so at the moment this runs the
  // `active` class is often still on the previous row — reading it would center
  // one row behind on every advance. Row *positions*, however, don't change when
  // currentIndex changes, and the virtualizer reports its rendered range via
  // rangeChanged (captured as `lastRange`), with DOM rows in position order. So
  // the rendered <li> for position `pos` is querySelectorAll('li')[pos - first]
  // — the correct element regardless of the content re-render timing.
  //
  // We then MEASURE that row's real offset and center it (computeCenterOffset,
  // pure/unit-tested) — never predict pos * rowHeight, whose sub-pixel error
  // accumulates the deeper you jump. For a far jump whose target isn't rendered
  // yet, approximate the scroll to bring it into the window, then center it
  // exactly once the virtualizer has rendered it (polled over a few frames).
  //
  // No-op if the active track is filtered out, the list is empty, or there's no
  // layout engine (happy-dom in tests → scrollHeight 0).
  private centerActiveTrack(): void {
    // Supersede any far-jump poll still running from a prior call.
    const token = ++this.centerToken;
    const count = this.filteredRows.length;
    const pos = this.filteredRows.findIndex((r) => r.i === this.currentIndex);
    if (pos < 0 || count === 0) return;
    const scroller = this.renderRoot.querySelector<HTMLElement>('.tracklist');
    if (!scroller || scroller.scrollHeight <= 0) return; // no layout (tests)

    // Center the rendered row for `pos` by its measured offset, if it's in the
    // virtualizer's current range. Returns false if `pos` isn't rendered yet.
    const tryCenter = (behavior: ScrollBehavior): boolean => {
      const lr = this.lastRange;
      if (!lr || pos < lr.first || pos > lr.last) return false;
      const lis = scroller.querySelectorAll<HTMLElement>('li');
      // lastRange is fed by the virtualizer's async rangeChanged, so just after a
      // filter/playlist change it can momentarily describe the OLD rows while the
      // DOM still holds them. When the rendered count doesn't match the range
      // span, the two are out of sync — bail so the far-jump poll re-centers once
      // the virtualizer catches up, rather than measuring a stale row.
      if (lis.length !== lr.last - lr.first + 1) return false;
      const el = lis[pos - lr.first];
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const rowTop = rect.top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const top = computeCenterOffset(
        rowTop,
        rect.height,
        scroller.clientHeight,
        scroller.scrollHeight,
      );
      scroller.scrollTo?.({ top, behavior });
      return true;
    };

    // Fast path: target already rendered (the common next/prev case) → smooth.
    if (tryCenter('smooth')) return;

    // Far jump (e.g. a shuffle advance): approximate with the average pitch to
    // bring the target into the rendered window, then center it exactly once the
    // virtualizer reports it in range. Poll a few frames; if it never lands
    // (extreme drift), the approximate scroll already left it roughly centered.
    scroller.scrollTop = Math.max(
      0,
      (pos * scroller.scrollHeight) / count - scroller.clientHeight / 2,
    );
    let tries = 0;
    const tick = (): void => {
      // A newer centerActiveTrack has taken over — stop, don't fight its scroll.
      if (this.centerToken !== token) return;
      if (tryCenter('auto') || ++tries > 20) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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

  // "{author} · {n} tracks · {total duration} · {created – updated}", each part
  // conditional. The author is a <span part="creator"> so skins can still target
  // it after the merge; its styling is uniform with the rest of the line.
  private renderMetaLine(pl: Playlist) {
    const stats: string[] = [`${pl.tracks.length} ${pl.tracks.length === 1 ? 'track' : 'tracks'}`];
    const total = sumDurationMs(pl.tracks);
    if (total != null) stats.push(formatTotalDuration(total));
    const date = formatDateRange(pl.dateCreated, pl.dateUpdated);
    if (date) stats.push(date);
    const statsText = stats.join(' · ');
    return html`<p class="meta-line" part="meta-line">
      ${
        pl.creator
          ? html`<span class="author" part="creator">${pl.creator}</span>${statsText ? ' · ' : ''}`
          : nothing
      }${statsText}
    </p>`;
  }

  private async onPlaylistChange(e: Event): Promise<void> {
    const src = (e.currentTarget as HTMLSelectElement).value;
    if (src === this.src) return;
    this.src = src;
    if (await this.loadPlaylist()) await this.initProvider();
  }

  // Derived, filtered view — never mutates pl.tracks or playback indices. Each
  // row carries its real pl.tracks index so selection maps back correctly.
  private get filteredRows(): Array<{ t: Track; i: number }> {
    const pl = this.playlist;
    if (!pl) return [];
    return pl.tracks
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => matchesFilter(t, this.filterQuery));
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

  private toggleVideoExpanded(): void {
    this.videoExpanded = !this.videoExpanded;
  }

  private toggleDescExpanded(): void {
    this.descExpanded = !this.descExpanded;
    // On collapse, the clamp is reapplied — re-measure once it settles so the
    // toggle disappears if the text no longer overflows at this width.
    if (!this.descExpanded) {
      void this.updateComplete.then(() => this.measureDescOverflow());
    }
  }

  // Whether the collapsed description overflows its capped (max-height) box.
  // Only meaningful while collapsed: an expanded description has no clamp, so we
  // leave the last value in place to keep the "less" toggle available.
  // happy-dom (tests) has no layout engine → heights are 0 → stays false.
  private measureDescOverflow(): void {
    if (this.descExpanded) return;
    const desc = this.renderRoot.querySelector('.description') as HTMLElement | null;
    this.descOverflows = desc ? desc.scrollHeight > desc.clientHeight + 1 : false;
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
    // Currently being checked by the availability queue.
    const pending = this.checking.has(index);
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
    const pending = this.checking.has(index);
    if (index === this.currentIndex) return 'active';
    if (unavailable) return 'unavailable';
    if (orphaned) return 'orphan';
    if (pending) return 'pending';
    return '';
  }

  // The per-row template, rendered by the virtualizer for each visible item.
  private renderRow(t: Track, i: number, playing: boolean) {
    const orphaned = isOrphan(t);
    const state = this.trackState(i, orphaned);
    // The active row's glyph mirrors playback; any other row offers play.
    // Inline SVG (not a Unicode glyph) so it renders monochrome in the theme
    // color rather than as a colored emoji — see MEDIA_ICON.
    const glyph = state === 'active' && playing ? MEDIA_ICON.pause : MEDIA_ICON.play;
    return html`
      <li
        class=${this.trackClasses(i, orphaned)}
        part="track"
        role="listitem"
        data-state=${state}
        @click=${() => this.onRowClick(i)}
      >
        <span class="num" part="track-number">
          <span class="idx">${state === 'pending' ? '⋯' : i + 1}</span>
          <span class="glyph">${glyph}</span>
        </span>
        <span class="thumb" part="track-art">
          ${
            t.image
              ? html`<img src=${t.image} alt="" loading="lazy" />`
              : html`<span class="thumb-ph" aria-hidden="true">♪</span>`
          }
        </span>
        <span class="cell">
          <span class="t-title">${t.title}</span>
          <span class="t-artist">${t.artist}</span>
        </span>
        <span class="dur"
          >${
            state === 'unavailable' ? '✕' : t.durationMs ? ByomPlayer.formatTime(t.durationMs) : ''
          }</span
        >
      </li>
    `;
  }

  // The virtualizer reports its rendered index range (positions within the
  // filtered rows). Record it and enqueue availability checks for the newly
  // visible window. Payload matches @lit-labs/virtualizer's RangeChangedEvent
  // (numeric first/last); read defensively so the handler is safe under
  // happy-dom (where the event never fires).
  private onRangeChanged = (e: Event): void => {
    const { first, last } = e as Event & { first?: number; last?: number };
    if (typeof first !== 'number' || typeof last !== 'number' || first < 0) return;
    this.lastRange = { first, last };
    this.syncAvailabilityChecks();
  };

  render() {
    const pl = this.playlist;
    if (!pl) return html`<div class="loading">Loading…</div>`;
    const q = this.filterQuery.trim();
    const rows = this.filteredRows;
    const playing = this.playbackState === 'playing';
    // The selector's visible label is the current playlist's title (from the
    // <byom-playlist> children), falling back to the loaded manifest title.
    const currentTitle = this.playlists.find((p) => p.src === this.src)?.title ?? pl.title;
    return html`
      <div class="root" part="root">
        <div class="head" part="header">
          <div class="art" part="art">
            ${
              pl.image
                ? html`<img class="art-img" src=${pl.image} alt="" />`
                : html`<span class="art-ph" aria-hidden="true">🎵</span>`
            }
          </div>
          <div class="meta" part="meta">
            ${
              this.playlists.length > 1
                ? html`<div class="title-wrap" part="title">
                    <h2 class="title title--switch">
                      ${currentTitle}<span class="caret" aria-hidden="true">▾</span>
                    </h2>
                    <select
                      class="title-select"
                      aria-label="Playlist"
                      @change=${this.onPlaylistChange}
                    >
                      ${this.playlists.map(
                        (p) =>
                          html`<option value=${p.src} ?selected=${p.src === this.src}>
                            ${p.title}
                          </option>`,
                      )}
                    </select>
                  </div>`
                : html`<h2 class="title" part="title">${pl.title}</h2>`
            }
            ${this.renderMetaLine(pl)}
          </div>
          ${
            pl.annotation
              ? html`<div class="desc-block" part="description-block">
                  <div
                    class="description ${this.descExpanded ? '' : 'is-collapsed'}"
                    part="description"
                  >
                    ${unsafeHTML(renderMarkdownInline(pl.annotation))}
                  </div>
                  ${
                    this.descOverflows
                      ? html`<button
                          class="desc-toggle"
                          part="control description-toggle"
                          @click=${this.toggleDescExpanded}
                          aria-expanded=${this.descExpanded ? 'true' : 'false'}
                        >
                          ${this.descExpanded ? '▴ less' : '▾ more'}
                        </button>`
                      : nothing
                  }
                </div>`
              : nothing
          }
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
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3"></circle>
                    <path
                      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    ></path>
                  </svg>
                </button>`
          }
        </div>
        <div class="transport" part="transport">
          <div class="ctl-group">
            <button class="prev" part="control prev" @click=${this.prev} aria-label="Previous">
              ${MEDIA_ICON.prev}
            </button>
            <button
              class="playpause"
              part="control play"
              @click=${this.togglePlay}
              aria-label=${playing ? 'Pause' : 'Play'}
            >
              ${playing ? MEDIA_ICON.pause : MEDIA_ICON.play}
            </button>
            <button class="next" part="control next" @click=${this.next} aria-label="Next">
              ${MEDIA_ICON.next}
            </button>
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
          ${
            this.preview
              ? html`<span
                  class="preview-badge"
                  part="preview-badge"
                  title="If you're signed into Spotify Premium in this browser, press ▶ in the Spotify player below for the full track."
                  >Preview · 30s ⓘ</span
                >`
              : nothing
          }
          <button
            class="shuffle ${this.shuffle ? 'on' : ''}"
            part="control shuffle"
            @click=${this.toggleShuffle}
            aria-label="Shuffle"
            aria-pressed=${this.shuffle ? 'true' : 'false'}
            title=${this.shuffle ? 'Shuffle: on' : 'Shuffle: off'}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="16 3 21 3 21 8"></polyline>
              <line x1="4" y1="20" x2="21" y2="3"></line>
              <polyline points="21 16 21 21 16 21"></polyline>
              <line x1="15" y1="15" x2="21" y2="21"></line>
              <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
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
        <div class="stage ${this.videoExpanded ? 'video-expanded' : ''}" part="stage">
          <div class="tracklist-empty">
            ${rows.length === 0 && q ? html`<p class="no-matches">No tracks match "${q}"</p>` : nothing}
          </div>
          <div class="tracklist" part="tracklist">
            <lit-virtualizer
              role="list"
              .items=${rows}
              .keyFunction=${(row: { i: number }) => row.i}
              .renderItem=${(row: { t: Track; i: number }) => this.renderRow(row.t, row.i, playing)}
              @rangeChanged=${this.onRangeChanged}
            ></lit-virtualizer>
          </div>
          <div class="video-wrap" part="video-wrap">
            <div class="video" part="video"></div>
            <button
              class="video-toggle"
              part="video-toggle"
              type="button"
              @click=${this.toggleVideoExpanded}
              aria-expanded=${this.videoExpanded ? 'true' : 'false'}
              aria-label=${this.videoExpanded ? 'Collapse video' : 'Expand video'}
              title=${this.videoExpanded ? 'Collapse video' : 'Expand video'}
            >
              ${this.videoExpanded ? '×' : '⤢'}
            </button>
          </div>
        </div>
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
      --byom-warn: #b06a00;
      --byom-font: system-ui, sans-serif;
      --byom-border-radius: 8px;
      --byom-video-scale: 0.42;

      display: block;
      background: var(--byom-bg);
      color: var(--byom-text);
      font-family: var(--byom-font);
      border-radius: var(--byom-border-radius);
      padding: 1rem;
      position: relative; /* anchor for the settings modal overlay */
    }
    /* App-shell wrapper. A flex column that fills the host's height when the host
       is given one (e.g. a viewport-fitted page shell): the stage flexes into the
       remaining space and the tracklist is the single scroll region. An internal
       wrapper (not :host) so a consumer overriding the host's display can't
       defeat it. container-type drives width-based @container queries for the
       responsive head below. When the host is unconstrained, height:100% resolves
       to auto and the player is content-sized. */
    .root {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      container-type: inline-size;
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
    /* Header grid: cover art (left, spanning both rows) + text column
       (title + meta line — author, track stats — on row 1, description on row 2)
       + settings gear (right, spanning both rows). At narrow container width the
       head restacks: the cover shrinks and the description drops to its own
       full-width row (see @container below). */
    .head {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        'art meta gear'
        'art desc gear';
      column-gap: 0.9rem;
      row-gap: 0.25rem;
      align-items: start;
    }
    .art {
      grid-area: art;
      width: 104px;
      height: 104px;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: var(--byom-surface);
      border: 1px solid var(--byom-border);
      border-radius: calc(var(--byom-border-radius) / 2);
      color: var(--byom-text-muted);
      font-size: 2.6rem;
    }
    .art-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .meta {
      grid-area: meta;
      min-width: 0;
    }
    .title {
      margin: 0;
      font-size: 1.35rem;
      line-height: 1.15;
      font-weight: 700;
      color: var(--byom-text);
    }
    /* Title-as-selector: a visible title + adjacent ▾, with a transparent native
       <select> overlaid for interaction. Keeps the caret glued to the title
       regardless of how wide the widest option is. */
    .title-wrap {
      position: relative;
      display: inline-block;
      max-width: 100%;
    }
    .title--switch {
      cursor: pointer;
    }
    .title--switch .caret {
      margin-left: 0.35rem;
      font-size: 0.6em;
      color: var(--byom-text-muted);
      vertical-align: middle;
    }
    .title-wrap:hover .title--switch,
    .title-wrap:focus-within .title--switch,
    .title-wrap:hover .title--switch .caret,
    .title-wrap:focus-within .title--switch .caret {
      color: var(--byom-accent);
    }
    .title-select {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      color: transparent;
      font: inherit;
      opacity: 0;
      cursor: pointer;
    }
    .meta-line {
      margin: 0.3rem 0 0;
      color: var(--byom-text-muted);
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
    }
    .desc-block {
      grid-area: desc;
      margin: 0.35rem 0 0;
    }
    .description {
      color: var(--byom-text-muted);
      font-size: 0.82rem;
      line-height: 1.4;
    }
    /* Toggle is hidden by default (wide players never clamp). */
    .desc-toggle {
      display: none;
    }
    /* Narrow container: cover shrinks and the description takes its own
       full-width row beneath the cover + title/meta. */
    @container (max-width: 30rem) {
      .head {
        grid-template-areas:
          'art meta gear'
          'desc desc desc';
      }
      .art {
        width: 52px;
        height: 52px;
        font-size: 1.4rem;
      }
      /* Collapse long descriptions on narrow players to ~2 lines, the lower
         portion fading out via the mask gradient (no ellipsis, so the text
         dissolves rather than getting cut with "…"). */
      .description.is-collapsed {
        max-height: calc(1.4em * 2);
        overflow: hidden;
        -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent);
        mask-image: linear-gradient(to bottom, #000 55%, transparent);
      }
      .desc-toggle {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        /* A <button> shrink-wraps to its content even when block-level, so
           auto inline margins (not justify-content) are what center it. */
        margin: 0 auto 0;
        padding: 0;
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--byom-accent);
        font: inherit;
        font-size: 0.78rem;
      }
      /* When collapsed, lift the toggle up so it overlaps the faded tail of the
         description — the mask makes that text transparent, so the centered
         toggle reads cleanly there and we reclaim ~a line of vertical space.
         Only when collapsed: expanded text is fully opaque and mustn't be
         covered. */
      .description.is-collapsed + .desc-toggle {
        margin-top: -0.45rem;
      }
    }
    .description a {
      color: var(--byom-accent);
      text-decoration: none;
    }
    .description a:hover {
      text-decoration: underline;
    }
    /* Stage fills the app-shell's remaining height: the tracklist (the single
       scroll region) flexes into it, and a mounted 16:9 embed reserves capped
       space above. No fixed viewport cap — the host bounds the height. */
    .stage {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1 1 auto;
      min-height: 0;
      margin-top: 0.5rem;
      position: relative;
    }
    .video {
      flex: 0 0 auto;
      aspect-ratio: 16 / 9;
      /* Cap so a short shell still leaves room for the tracklist; the 16:9 box
         letterboxes within when capped. */
      max-height: 30vh;
      /* The box's width is derived from the 30vh height cap (via aspect-ratio),
         so on players wider than the box it must center rather than pin left. */
      margin-inline: auto;
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
    /* The embed lives inside a positioned wrapper so a corner toggle can anchor
       to it. Wrapper reserves space like the old .video flex child did, and the
       whole region hides when no embed is mounted. */
    .video-wrap {
      position: relative;
      flex: 0 0 auto;
    }
    .video-wrap:has(.video:empty) {
      display: none;
    }
    /* Toggle only appears on narrow players (see the @container block). */
    .video-toggle {
      display: none;
    }
    /* Narrow players: the embed collapses to a small floating "preview" pinned
       to the lower-right of the stage. It's rendered at a full 320x180 and
       scaled down via transform (not a natively-tiny iframe) so YouTube and
       Spotify both stay faithful. Tapping the preview expands it to full width;
       tapping again collapses it. --byom-video-scale is the single size knob. */
    @container (max-width: 30rem) {
      /* --- Collapsed (default): floating mini in the corner --- */
      .stage:not(.video-expanded) .video-wrap {
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 2;
        width: calc(320px * var(--byom-video-scale));
        height: calc(180px * var(--byom-video-scale));
        max-height: none;
        overflow: hidden;
        border: 1px solid var(--byom-border);
        border-radius: calc(var(--byom-border-radius) / 2);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
      }
      .stage:not(.video-expanded) .video {
        width: 320px;
        height: 180px;
        max-height: none;
        aspect-ratio: auto;
        transform: scale(var(--byom-video-scale));
        transform-origin: top left;
      }
      /* Reserve room so the last rows can scroll clear of the floating mini,
         but only when an embed is actually mounted. */
      .stage:not(.video-expanded):has(.video:not(:empty)) .tracklist {
        padding-bottom: calc(180px * var(--byom-video-scale) + 0.75rem);
      }
      /* Transparent full-cover tap target → expand. Also stops accidental taps
         on the embed's own controls while it's tiny. A small scrimmed glyph in
         the corner hints that it's tappable. */
      .stage:not(.video-expanded) .video-toggle {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        padding: 2px 4px;
        font-size: 0.8rem;
        line-height: 1;
        color: var(--byom-text);
        background: transparent;
        border: 0;
        cursor: pointer;
        z-index: 3;
      }
      .stage:not(.video-expanded) .video-toggle::before {
        content: '';
        position: absolute;
        right: 0;
        bottom: 0;
        width: 1.4rem;
        height: 1.4rem;
        background: color-mix(in srgb, var(--byom-bg) 70%, transparent);
        border-top-left-radius: calc(var(--byom-border-radius) / 2);
        z-index: -1;
      }

      /* --- Expanded: full-width embed (today's layout) + a corner collapse
             button. .video-wrap/.video fall back to their base rules; only the
             toggle needs positioning. --- */
      .stage.video-expanded .video-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: 4px;
        right: 4px;
        min-width: 1.6rem;
        min-height: 1.6rem;
        font-size: 1rem;
        line-height: 1;
        color: var(--byom-text);
        background: color-mix(in srgb, var(--byom-bg) 70%, transparent);
        border: 1px solid var(--byom-border);
        border-radius: 999px;
        cursor: pointer;
        z-index: 3;
      }
    }
    /* Transport footer: prev/play-pause/next + inline seek + shuffle. */
    .transport {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-top: 0.9rem;
    }
    .ctl-group {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex: 0 0 auto;
    }
    .transport button {
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
    .transport button:hover {
      background: color-mix(in srgb, var(--byom-text) 10%, transparent);
    }
    /* Media icons size to each button's font-size (prev/next 1.3rem, playpause
       1.6rem), matching the metrics of the glyphs they replace. Shuffle keeps
       its own more-specific size rule. */
    .transport button svg {
      width: 1em;
      height: 1em;
      display: block;
    }
    .transport .playpause {
      font-size: 1.6rem;
      color: var(--byom-on-accent);
      background: var(--byom-accent);
    }
    /* Heads-up pill shown when the Spotify embed is stuck on a 30s preview; the
       tooltip explains the Premium-click path. Colors derive from --byom-warn so
       it adapts across themes. */
    .preview-badge {
      flex: 0 0 auto;
      align-self: center;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      cursor: help;
      color: var(--byom-warn);
      border: 1px solid color-mix(in srgb, var(--byom-warn) 45%, transparent);
      background: color-mix(in srgb, var(--byom-warn) 12%, transparent);
      border-radius: 999px;
      padding: 0.12rem 0.5rem;
    }
    .transport .playpause:hover {
      background: var(--byom-accent);
      filter: brightness(1.08);
    }
    /* Shuffle is a round icon button like the transport controls; the accent
       fill signals the on state (toggle). */
    .transport .shuffle {
      flex: 0 0 auto;
      opacity: 0.7;
    }
    .transport .shuffle svg {
      width: 1.15rem;
      height: 1.15rem;
      display: block;
    }
    .transport .shuffle.on {
      background: var(--byom-accent);
      color: var(--byom-on-accent);
      opacity: 1;
    }
    .seek {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }
    .seek .progress {
      flex: 1;
      min-width: 0;
      accent-color: var(--byom-accent);
    }
    .seek .time {
      flex: 0 0 auto;
      font-variant-numeric: tabular-nums;
      font-size: 0.72rem;
      color: var(--byom-text-muted);
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
      display: block;
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
    /* Spotify-style rows: number | title/artist | duration. */
    .tracklist li {
      /* The virtualizer positions each row absolutely, so it must be told to
         span the full width — otherwise it shrinks to its content and the 1fr
         title column has no slack to push the duration to the right edge. */
      width: 100%;
      box-sizing: border-box;
      cursor: pointer;
      display: grid;
      /* First column fits up to a 4-digit track number (8000+ track playlists). */
      grid-template-columns: 2.2rem var(--byom-track-art-size, 2rem) 1fr auto;
      align-items: center;
      gap: 0.6rem;
      padding: 0.3rem 0.5rem 0.3rem 0.4rem;
      border-left: 3px solid transparent; /* reserve the active bar's width */
      border-radius: calc(var(--byom-border-radius) / 2);
    }
    .tracklist li:hover {
      background: color-mix(in srgb, var(--byom-text) 8%, transparent);
    }
    .num {
      position: relative;
      text-align: center;
      color: var(--byom-text-muted);
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }
    .num .glyph {
      display: none;
      font-size: 0.85rem;
    }
    .num .glyph svg {
      width: 1em;
      height: 1em;
      display: block;
    }
    /* Hover a playable row → its number becomes a play glyph. */
    .tracklist li:not(.active):not(.unavailable):not(.pending):hover .num .idx {
      visibility: hidden;
    }
    .tracklist li:not(.active):not(.unavailable):not(.pending):hover .num .glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      inset: 0;
      color: var(--byom-text);
    }
    /* Per-row cover thumbnail (size tunable via --byom-track-art-size). */
    .thumb {
      width: var(--byom-track-art-size, 2rem);
      height: var(--byom-track-art-size, 2rem);
      border-radius: calc(var(--byom-border-radius) / 3);
      overflow: hidden;
      background: var(--byom-surface);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .thumb-ph {
      color: var(--byom-text-muted);
      font-size: 0.9rem;
    }
    .cell {
      min-width: 0;
    }
    .t-title {
      display: block;
      color: var(--byom-text);
      font-size: 0.9rem;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .t-artist {
      display: block;
      color: var(--byom-text-muted);
      font-size: 0.76rem;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dur {
      color: var(--byom-text-muted);
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
    }
    /* active: accent bar + tint, number becomes the pause/play glyph */
    .tracklist li.active {
      border-left-color: var(--byom-accent);
      background: color-mix(in srgb, var(--byom-accent) 12%, transparent);
    }
    .tracklist li.active .num {
      color: var(--byom-accent);
    }
    .tracklist li.active .num .idx {
      display: none;
    }
    .tracklist li.active .num .glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--byom-accent);
    }
    .tracklist li.active .t-title {
      color: var(--byom-accent);
      font-weight: 600;
    }
    .tracklist li.active .t-artist {
      color: color-mix(in srgb, var(--byom-accent) 65%, var(--byom-text-muted));
    }
    /* orphan: muted + a detached marker after the title */
    .tracklist li.orphan .t-title {
      color: var(--byom-text-muted);
    }
    .tracklist li.orphan .t-title::after {
      content: '↯';
      margin-left: 0.35rem;
      opacity: 0.8;
      font-size: 0.85em;
    }
    /* unavailable: struck title (the ✕ lives in the duration slot) */
    .tracklist li.unavailable .t-title {
      color: var(--byom-text-muted);
      text-decoration: line-through;
    }
    /* pending: muted, accent ⋯ shown in the number slot (rendered in markup) */
    .tracklist li.pending .num {
      color: var(--byom-accent);
    }
    .tracklist li.pending .t-title,
    .tracklist li.pending .t-artist {
      color: var(--byom-text-muted);
    }
    .status .halted {
      color: var(--byom-accent);
      font-size: 0.85rem;
    }
    .gear {
      grid-area: gear;
      flex: 0 0 auto;
      display: block;
      background: transparent;
      border: none;
      color: var(--byom-text-muted);
      padding: 0;
      margin-top: 0.15rem; /* nudge the icon down to the title's cap height */
      cursor: pointer;
    }
    .gear svg {
      display: block;
      width: 1.5rem;
      height: 1.5rem;
    }
    .gear:hover {
      color: var(--byom-text);
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
