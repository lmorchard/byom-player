// Formatting helpers for the playlist meta line (track count · duration · date).
// Per-track / seek times use ByomPlayer.formatTime (m:ss); these cover the
// playlist-level total and the creation date.

import type { Track } from './types';

// Total playlist duration in ms, or null if ANY track lacks a duration — a
// partial sum would silently undercount, so we'd rather show nothing.
export function sumDurationMs(tracks: Track[]): number | null {
  if (!tracks.length) return null;
  let total = 0;
  for (const t of tracks) {
    if (typeof t.durationMs !== 'number') return null;
    total += t.durationMs;
  }
  return total;
}

// Friendly total, e.g. "24 min", "1 hr 58 min", "2 hr".
export function formatTotalDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Jul 2026" from an ISO date string; null if absent/unparseable.
export function formatMonthYear(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
