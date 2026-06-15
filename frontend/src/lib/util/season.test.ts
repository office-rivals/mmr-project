import { describe, it, expect } from 'vitest';
import { selectCurrentSeason } from './season';

// NOW is fixed so the tests are deterministic.
const NOW = Date.parse('2026-06-15T12:00:00Z');

describe('selectCurrentSeason', () => {
  it('skips a not-yet-started season at index 0 and returns the active one', () => {
    const seasons = [
      { id: 'future', startsAt: '2026-09-01T00:00:00Z' },
      { id: 'active', startsAt: '2026-03-01T00:00:00Z' },
      { id: 'old', startsAt: '2025-01-01T00:00:00Z' },
    ];
    expect(selectCurrentSeason(seasons, NOW)?.id).toBe('active');
  });

  it('returns the most recent started season when none are in the future', () => {
    const seasons = [
      { id: 'active', startsAt: '2026-03-01T00:00:00Z' },
      { id: 'old', startsAt: '2025-01-01T00:00:00Z' },
    ];
    expect(selectCurrentSeason(seasons, NOW)?.id).toBe('active');
  });

  it('picks the latest started season regardless of list ordering', () => {
    const seasons = [
      { id: 'old', startsAt: '2025-01-01T00:00:00Z' },
      { id: 'active', startsAt: '2026-03-01T00:00:00Z' },
      { id: 'future', startsAt: '2026-09-01T00:00:00Z' },
    ];
    expect(selectCurrentSeason(seasons, NOW)?.id).toBe('active');
  });

  it('includes a season that starts exactly now', () => {
    const seasons = [{ id: 'now', startsAt: '2026-06-15T12:00:00Z' }];
    expect(selectCurrentSeason(seasons, NOW)?.id).toBe('now');
  });

  it('ignores seasons with an unparseable startsAt', () => {
    const seasons = [
      { id: 'bad', startsAt: 'not-a-date' },
      { id: 'active', startsAt: '2026-03-01T00:00:00Z' },
    ];
    expect(selectCurrentSeason(seasons, NOW)?.id).toBe('active');
  });

  it('returns null when every season is in the future', () => {
    const seasons = [
      { id: 'future-2', startsAt: '2027-01-01T00:00:00Z' },
      { id: 'future-1', startsAt: '2026-09-01T00:00:00Z' },
    ];
    expect(selectCurrentSeason(seasons, NOW)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(selectCurrentSeason([], NOW)).toBeNull();
  });
});
