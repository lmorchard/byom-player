import type { Track } from './types';
import type { AudioProvider, ProviderState } from './providers/types';

// PlaybackController owns the queue and reacts to provider state: it advances to
// the next track when one ends and skips (recording the failure) on error.
export class PlaybackController {
  index = 0;
  state: ProviderState = 'uninitialized';
  readonly failed = new Set<number>();

  constructor(
    private readonly provider: AudioProvider,
    private readonly tracks: Track[],
    private readonly onChange: () => void = () => {},
  ) {
    this.provider.onStateChange((s) => this.handle(s));
  }

  async start(index = 0): Promise<void> {
    if (index < 0 || index >= this.tracks.length) return;
    this.index = index;
    await this.provider.load(this.tracks[index]);
    await this.provider.play();
  }

  async play(): Promise<void> {
    await this.provider.play();
  }

  pause(): void {
    this.provider.pause();
  }

  async next(): Promise<void> {
    if (this.index < this.tracks.length - 1) {
      await this.start(this.index + 1);
    }
  }

  async prev(): Promise<void> {
    if (this.index > 0) {
      await this.start(this.index - 1);
    }
  }

  private handle(state: ProviderState): void {
    this.state = state;
    if (state === 'ended') {
      void this.next();
    } else if (state === 'error') {
      this.failed.add(this.index);
      void this.next();
    }
    this.onChange();
  }
}
