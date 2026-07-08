import type { Track } from '../types';

// The playback state machine, shared across all providers.
export type ProviderState = 'uninitialized' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

// AudioProvider decouples the UI from the audio source. An implementation owns
// both resolution (turning a Track into something playable) and playback.
export interface AudioProvider {
  name: string;
  initialize(): Promise<void>;
  load(track: Track): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(positionMs: number): void;
  onStateChange(callback: (state: ProviderState) => void): void;
}
