import type { Track } from '../types';

// The playback state machine, shared across all providers.
//   unavailable = the source answered but the track isn't in the collection
//                 (a clean miss — safe to skip freely)
//   error       = a transient/playback failure (network, 5xx, stream error)
//                 that should NOT be treated as a permanent miss
export type ProviderState =
  'uninitialized' | 'ready' | 'playing' | 'paused' | 'ended' | 'unavailable' | 'error';

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
  // Release resources (stop audio, clear timers, remove listeners). Called when
  // the host element is disconnected so playback never outlives the component.
  dispose(): void;
}
