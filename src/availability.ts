import type { Track } from './types';
import type { AudioProvider, AvailabilityStatus } from './providers/types';

export interface SweepOptions {
  // Delay between checks (ms). Keeps the sweep gentle so it doesn't hammer the
  // source or compete with active playback. Default 300.
  delayMs?: number;
  signal?: AbortSignal;
}

// sweepAvailability gently checks each track's availability in the background,
// one at a time with a delay between, reporting each result as it arrives. It is
// a no-op for providers that can't check, and stops promptly when aborted.
export async function sweepAvailability(
  provider: AudioProvider,
  tracks: Track[],
  onResult: (index: number, status: AvailabilityStatus) => void,
  opts: SweepOptions = {},
): Promise<void> {
  const check = provider.checkAvailability?.bind(provider);
  if (!check) return;
  const isCached = provider.isResolutionCached?.bind(provider);

  const delayMs = opts.delayMs ?? 300;
  for (let i = 0; i < tracks.length; i++) {
    if (opts.signal?.aborted) return;
    // A cache hit resolves without touching the source, so it needs no cooldown.
    const cached = isCached?.(tracks[i]) ?? false;
    let status: AvailabilityStatus;
    try {
      status = await check(tracks[i]);
    } catch {
      status = 'unknown';
    }
    if (opts.signal?.aborted) return;
    onResult(i, status);

    if (delayMs > 0 && !cached && i < tracks.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
