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
  // checkAvailability call for it won't touch the source. The background
  // prescan uses this to skip its inter-check throttle for cache hits.
  isResolutionCached?(track: Track): boolean;
  // Optional: render a visible surface (e.g. a video) into the host element.
  // Called before initialize(). Providers without one simply omit it.
  attach?(element: HTMLElement): void;
  // --- Interactive auth (declarative; the host renders it in the settings panel) ---
  // Providers with interactive sign-in (Spotify Connect, Plex Link) expose their
  // current auth state; the host renders the status + buttons and calls
  // runAuthAction() on click, then re-reads getAuthState() when onAuthChange fires.
  // Providers whose credentials are plain config fields (Subsonic, Jellyfin) omit
  // these entirely.
  getAuthState?(): AuthState;
  runAuthAction?(id: string): Promise<void>;
  onAuthChange?(cb: () => void): void;
  // Optional: register a callback fired when the provider's session is reset
  // (e.g. the user unlinks/disconnects), so the host can clear cached
  // availability marks that no longer apply.
  onReset?(cb: () => void): void;
}

// A button the settings panel renders for an interactive-auth provider.
export interface AuthAction {
  id: string;
  label: string;
}

// A snapshot of a provider's interactive-auth state for the settings panel.
export interface AuthState {
  status?: string; // optional human-readable line, e.g. "Not connected"
  actions: AuthAction[]; // buttons to render (empty = nothing actionable)
  busy?: boolean; // an action is in flight — disable buttons
}
