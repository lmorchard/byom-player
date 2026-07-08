import type { Track } from '../types';

// The playback state machine, shared across all providers.
//   unavailable = the source answered but the track isn't in the collection
//                 (a clean miss — safe to skip freely)
//   error       = a transient/playback failure (network, 5xx, stream error)
//                 that should NOT be treated as a permanent miss
export type ProviderState =
  'uninitialized' | 'ready' | 'playing' | 'paused' | 'ended' | 'unavailable' | 'error';

// Result of a lightweight, no-playback availability check.
//   unknown = couldn't determine (transient error) — don't penalize the track
export type AvailabilityStatus = 'available' | 'unavailable' | 'unknown';

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
  // Optional: report playback position + duration (ms) as they change. HTML5
  // Audio uses `timeupdate`; a YouTube iframe would poll; the mock derives it
  // from its timer. durationMs is 0 when not yet known.
  onProgress?(callback: (positionMs: number, durationMs: number) => void): void;
  // Release resources (stop audio, clear timers, remove listeners). Called when
  // the host element is disconnected so playback never outlives the component.
  dispose(): void;
  // Optional: cheaply check whether a track can be resolved, without loading or
  // playing it. Providers that can't (e.g. the mock) simply omit this.
  checkAvailability?(track: Track): Promise<AvailabilityStatus>;
}
