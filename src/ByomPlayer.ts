import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Playlist } from './types';
import type { AudioProvider, AvailabilityStatus, ProviderState } from './providers/types';
import { loadManifest } from './manifest';
import { PlaybackController } from './controller';
import { createProvider } from './providers/registry';
import { sweepAvailability } from './availability';

type ProviderFactory = (name: string, config: Record<string, unknown>) => AudioProvider;

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

  private controller: PlaybackController | null = null;
  private sweepAbort: AbortController | null = null;
  private seeking = false; // user is dragging the progress bar

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadAndInit();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.sweepAbort?.abort();
    this.sweepAbort = null;
    this.controller?.dispose();
    this.controller = null;
  }

  private async loadAndInit(): Promise<void> {
    if (!this.src) return;
    this.sweepAbort?.abort();
    this.availability = new Map();
    this.hasVideo = false;
    try {
      const res = await fetch(this.src);
      this.playlist = loadManifest(await res.json());
    } catch {
      this.playbackState = 'error';
      return;
    }
    const factory = this.providerFactory ?? createProvider;
    const config = this.debug ? { ...this.providerConfig, debug: true } : this.providerConfig;
    const prov = factory(this.provider, config);
    if (prov.attach) {
      // Ensure the .video region is rendered, then let the provider mount into it.
      await this.updateComplete;
      const host = this.renderRoot.querySelector('.video');
      if (host) {
        prov.attach(host as HTMLElement);
        this.hasVideo = true; // reserve space + shorten the tracklist
      }
    }
    await prov.initialize();
    this.controller = new PlaybackController(
      prov,
      this.playlist.tracks,
      () => this.syncFromController(),
      { skipDelayMs: this.skipDelayMs, debug: this.debug },
    );
    if (this.prescan && prov.checkAvailability) {
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
      <ol class="tracklist ${this.hasVideo ? 'with-video' : ''}">
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
      <div class="video" part="video"></div>
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
    .controls button {
      cursor: pointer;
    }
    .controls .shuffle {
      border: 1px solid var(--byom-accent);
      border-radius: 999px;
      background: transparent;
      color: var(--byom-text);
      padding: 0.1rem 0.6rem;
      font-size: 0.8rem;
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
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'byom-player': ByomPlayer;
  }
}
