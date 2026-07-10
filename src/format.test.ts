import { describe, it, expect } from 'vitest';
import { sumDurationMs, formatTotalDuration, formatMonthYear } from './format';
import type { Track } from './types';

const t = (durationMs?: number): Track => ({ title: 't', artist: 'a', durationMs });

describe('sumDurationMs', () => {
  it('sums when every track has a duration', () => {
    expect(sumDurationMs([t(60000), t(120000)])).toBe(180000);
  });
  it('returns null if any track lacks a duration', () => {
    expect(sumDurationMs([t(60000), t(undefined)])).toBeNull();
  });
  it('returns null for an empty list', () => {
    expect(sumDurationMs([])).toBeNull();
  });
});

describe('formatTotalDuration', () => {
  it('formats under an hour as minutes', () => {
    expect(formatTotalDuration(24 * 60000)).toBe('24 min');
  });
  it('formats an hour-plus with minutes', () => {
    expect(formatTotalDuration(118 * 60000)).toBe('1 hr 58 min');
  });
  it('drops the minutes on a round hour', () => {
    expect(formatTotalDuration(120 * 60000)).toBe('2 hr');
  });
});

describe('formatMonthYear', () => {
  it('formats an ISO date to month + year', () => {
    expect(formatMonthYear('2026-07-08T12:00:00Z')).toBe('Jul 2026');
  });
  it('returns null for absent or unparseable input', () => {
    expect(formatMonthYear(undefined)).toBeNull();
    expect(formatMonthYear('not a date')).toBeNull();
  });
});
