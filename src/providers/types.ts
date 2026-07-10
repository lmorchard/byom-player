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
  // Optional: report whether a track's resolution is already cached, so a
  // checkAvailability call for it won't touch the source. The background sweep
  // uses this to skip its inter-check throttle for cache hits.
  isResolutionCached?(track: Track): boolean;
  // Optional: render a visible surface (e.g. a video) into the host element.
  // Called before initialize(). Providers without one simply omit it.
  attach?(element: HTMLElement): void;
  // Optional: render auth controls (Connect/Link/Disconnect) into a host-provided
  // element — the settings panel's auth slot. Providers without interactive auth
  // omit it. When not called, providers fall back to the attach()/video target.
  attachAuth?(element: HTMLElement): void;
  // Optional: register a callback fired when the provider's session is reset
  // (e.g. the user unlinks/disconnects), so the host can clear cached
  // availability marks that no longer apply.
  onReset?(cb: () => void): void;
}
