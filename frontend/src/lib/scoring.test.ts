import { describe, expect, it } from 'vitest';
import {
  MAX_SCORE,
  deriveLosingTeam,
  isScorePairComplete,
  loserScoreOptions,
} from './scoring';

describe('loserScoreOptions', () => {
  it('returns no options for a free-form league', () => {
    expect(loserScoreOptions(null)).toEqual([]);
  });

  it('stops one below the winning score', () => {
    expect(loserScoreOptions(10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('includes 0 — a zero score is legitimate (🥚)', () => {
    expect(loserScoreOptions(1)).toEqual([0]);
  });
});

describe('deriveLosingTeam', () => {
  it('has no losing side in a free-form league', () => {
    expect(deriveLosingTeam(21, 15, null)).toBeNull();
  });

  it('names the side that did not reach the target', () => {
    expect(deriveLosingTeam(10, 3, 10)).toBe('team2');
    expect(deriveLosingTeam(3, 10, 10)).toBe('team1');
  });

  it('is null while neither side has reached the target', () => {
    expect(deriveLosingTeam(-1, -1, 10)).toBeNull();
    expect(deriveLosingTeam(3, 4, 10)).toBeNull();
  });

  it('prefers team1 when both somehow hold the winning score', () => {
    expect(deriveLosingTeam(10, 10, 10)).toBe('team2');
  });
});

describe('isScorePairComplete', () => {
  it('free-form: needs two non-negative, unequal scores', () => {
    expect(isScorePairComplete(21, 15, null)).toBe(true);
    expect(isScorePairComplete(0, 15, null)).toBe(true);
    expect(isScorePairComplete(11, 11, null)).toBe(false);
    expect(isScorePairComplete(-1, 15, null)).toBe(false);
    expect(isScorePairComplete(21, -1, null)).toBe(false);
  });

  it('fixed-target: needs a winner at the target and an entered loser score', () => {
    expect(isScorePairComplete(10, 0, 10)).toBe(true);
    expect(isScorePairComplete(10, 9, 10)).toBe(true);
    expect(isScorePairComplete(10, -1, 10)).toBe(false);
    expect(isScorePairComplete(-1, -1, 10)).toBe(false);
    expect(isScorePairComplete(8, 9, 10)).toBe(false);
  });
});

describe('MAX_SCORE', () => {
  it('mirrors the API cap', () => {
    expect(MAX_SCORE).toBe(255);
  });
});
