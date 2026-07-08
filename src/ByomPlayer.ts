import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Playlist } from './types';
import type { AudioProvider, ProviderState } from './providers/types';
import { loadManifest } from './manifest';
import { PlaybackController } from './controller';
import { createProvider } from './providers/registry';

type ProviderFactory = (name: string, config: Record<string, unknown>) => AudioProvider;

@customElement('byom-player')
export class ByomPlayer extends LitElement {
  /** URL to the JSPF manifest. */
  @property() src = '';
  /** Which audio provider to use ('mock' | 'direct'). */
  @property() provider = 'mock';
  /** Provider-specific configuration (e.g. Navidrome credentials). */
  @property({ attribute: false }) providerConfig: Record<string, unknown> = {};
  /** Optional override for provider construction (host-supplied custom providers / tests). */
  @property({ attribute: false }) providerFactory?: ProviderFactory;

  @state() private playlist: Playlist | null = null;
  @state() private currentIndex = 0;
  @state() private playbackState: ProviderState = 'uninitialized';
  @state() private failed = new Set<number>();

  private controller: PlaybackController | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadAndInit();
  }

  private async loadAndInit(): Promise<void> {
    if (!this.src) return;
    try {
      const res = await fetch(this.src);
      this.playlist = loadManifest(await res.json());
    } catch {
      this.playbackState = 'error';
      return;
    }
    const factory = this.providerFactory ?? createProvider;
    const prov = factory(this.provider, this.providerConfig);
    await prov.initialize();
    this.controller = new PlaybackController(prov, this.playlist.tracks, () =>
      this.syncFromController(),
    );
  }

  private syncFromController(): void {
    if (!this.controller) return;
    this.currentIndex = this.controller.index;
    this.playbackState = this.controller.state;
    this.failed = new Set(this.controller.failed);
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

  private trackClasses(index: number, orphaned: boolean): string {
    return [
      index === this.currentIndex ? 'active' : '',
      orphaned ? 'orphan' : '',
      this.failed.has(index) ? 'unavailable' : '',
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
    .tracklist {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 20rem;
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
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'byom-player': ByomPlayer;
  }
}
