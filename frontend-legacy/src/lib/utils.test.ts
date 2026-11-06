import { describe, it, expect } from 'vitest';
import {
  groupMatchesByDate,
  isToday,
  matchDateGroupKey,
  matchDateGroupLabel,
} from './utils';

// Anchor "now" to a fixed local instant so date math is deterministic.
// Picked at midday to avoid any DST edge cases.
const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime(); // 2026-06-15 12:00 local

const iso = (d: Date) => d.toISOString();
const at = (year: number, month: number, day: number, hour = 12) =>
  iso(new Date(year, month - 1, day, hour, 0, 0));

describe('isToday', () => {
  it('returns true for a timestamp on the same local day as now', () => {
    expect(isToday(at(2026, 6, 15, 9), NOW)).toBe(true);
    expect(isToday(at(2026, 6, 15, 23), NOW)).toBe(true);
  });

  it('returns false for yesterday / tomorrow / older dates', () => {
    expect(isToday(at(2026, 6, 14), NOW)).toBe(false);
    expect(isToday(at(2026, 6, 16), NOW)).toBe(false);
    expect(isToday(at(2025, 6, 15), NOW)).toBe(false);
  });

  it('returns false for null / undefined / empty / unparseable input', () => {
    expect(isToday(null, NOW)).toBe(false);
    expect(isToday(undefined, NOW)).toBe(false);
    expect(isToday('', NOW)).toBe(false);
    expect(isToday('not-a-date', NOW)).toBe(false);
  });
});

describe('matchDateGroupKey', () => {
  it("returns 'today' / 'yesterday' for those relative days", () => {
    expect(matchDateGroupKey(at(2026, 6, 15), NOW)).toBe('today');
    expect(matchDateGroupKey(at(2026, 6, 14), NOW)).toBe('yesterday');
  });

  it('returns a stable YYYY-MM-DD key for older dates', () => {
    expect(matchDateGroupKey(at(2025, 3, 5), NOW)).toBe('2025-03-05');
  });

  it('distinguishes the same weekday/month/day in different years', () => {
    // Both display as "Wednesday, Mar 5" with no year.
    expect(matchDateGroupKey(at(2025, 3, 5), NOW)).not.toBe(
      matchDateGroupKey(at(2026, 3, 5), NOW)
    );
  });

  it('returns "" for null / undefined / empty / unparseable input', () => {
    expect(matchDateGroupKey(null, NOW)).toBe('');
    expect(matchDateGroupKey(undefined, NOW)).toBe('');
    expect(matchDateGroupKey('', NOW)).toBe('');
    expect(matchDateGroupKey('not-a-date', NOW)).toBe('');
  });
});

describe('matchDateGroupLabel', () => {
  it('returns "" for null / undefined / empty / unparseable input', () => {
    expect(matchDateGroupLabel(null, NOW)).toBe('');
    expect(matchDateGroupLabel(undefined, NOW)).toBe('');
    expect(matchDateGroupLabel('', NOW)).toBe('');
    expect(matchDateGroupLabel('not-a-date', NOW)).toBe('');
  });

  it('returns "Yesterday" for yesterday regardless of time of day', () => {
    expect(matchDateGroupLabel(at(2026, 6, 14, 0), NOW)).toBe('Yesterday');
    expect(matchDateGroupLabel(at(2026, 6, 14, 23), NOW)).toBe('Yesterday');
  });

  it('returns a weekday, month day string for older dates', () => {
    const label = matchDateGroupLabel(at(2026, 3, 5), NOW);
    expect(label).toBe('Thursday, Mar 5');
  });
});

describe('groupMatchesByDate', () => {
  const mk = (id: string, playedAt: string) => ({ id, playedAt });

  it('returns an empty array for no matches', () => {
    expect(groupMatchesByDate([], NOW)).toEqual([]);
  });

  it('labels only the first match of each non-today bucket', () => {
    const matches = [
      mk('m1', at(2026, 6, 15)), // today
      mk('m2', at(2026, 6, 15)),
      mk('m3', at(2026, 6, 14)), // yesterday — new bucket
      mk('m4', at(2026, 6, 14)),
      mk('m5', at(2026, 6, 12)), // older day — new bucket
      mk('m6', at(2026, 6, 12)),
    ];
    expect(groupMatchesByDate(matches, NOW)).toEqual([
      { match: matches[0], label: null },
      { match: matches[1], label: null },
      { match: matches[2], label: 'Yesterday' },
      { match: matches[3], label: null },
      { match: matches[4], label: 'Friday, Jun 12' },
      { match: matches[5], label: null },
    ]);
  });

  it('starts a new bucket for the very first match when it is not today', () => {
    const matches = [mk('m1', at(2026, 6, 13)), mk('m2', at(2026, 6, 13))];
    expect(groupMatchesByDate(matches, NOW)).toEqual([
      { match: matches[0], label: 'Saturday, Jun 13' },
      { match: matches[1], label: null },
    ]);
  });

  it('does not label a single today-only list', () => {
    const matches = [mk('m1', at(2026, 6, 15)), mk('m2', at(2026, 6, 15))];
    expect(groupMatchesByDate(matches, NOW)).toEqual([
      { match: matches[0], label: null },
      { match: matches[1], label: null },
    ]);
  });

  it('does not collapse two matches with colliding display labels across years', () => {
    // Both render as "Wednesday, Mar 5" with the legacy day-comparison
    // approach but live on different days in different years — each is its
    // own bucket.
    const matches = [
      mk('m1', at(2026, 6, 15)), // today
      mk('m2', at(2026, 3, 5)),
      mk('m3', at(2025, 3, 5)),
      mk('m4', at(2025, 3, 4)),
    ];
    const result = groupMatchesByDate(matches, NOW);
    expect(result[0].label).toBeNull();
    expect(result[1].label).not.toBeNull();
    expect(result[2].label).not.toBeNull();
    expect(result[1].label).not.toBe(result[2].label);
    expect(result[3].label).not.toBeNull();
    expect(result[2].label).not.toBe(result[3].label);
  });
});
