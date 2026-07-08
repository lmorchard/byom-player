import { LitElement, html, css, nothing } from 'lit';
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

  private controller: PlaybackController | null = null;
  private sweepAbort: AbortController | null = null;

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
    await prov.initialize();
    this.controller = new PlaybackController(
      prov,
      this.playlist.tracks,
      () => this.syncFromController(),
      { skipDelayMs: this.skipDelayMs, debug: this.debug },
    );
    if (this.prescan && prov.checkAvailability) {
      this.sweepAbort = new AbortController();
      void sweepAvailability(
        prov,
        this.playlist.tracks,
        (i, status) => {
          this.availability = new Map(this.availability).set(i, status);
          // Let the queue skip known-missing tracks (shuffle + advance).
          if (status === 'unavailable') this.controller?.markUnavailable(i, true);
        },
        { signal: this.sweepAbort.signal, delayMs: this.prescanDelayMs },
      );
    }
  }

  private syncFromController(): void {
    if (!this.controller) return;
    this.currentIndex = this.controller.index;
    this.playbackState = this.controller.state;
    this.failed = new Set(this.controller.failed);
    this.halted = this.controller.halted;
    this.shuffle = this.controller.shuffle;
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

  private trackClasses(index: number, orphaned: boolean): string {
    const unavailable = this.failed.has(index) || this.availability.get(index) === 'unavailable';
    return [
      index === this.currentIndex ? 'active' : '',
      orphaned ? 'orphan' : '',
      unavailable ? 'unavailable' : '',
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
      <ol class="tracklist">
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
