import { describe, expect, it } from 'vitest';
import {
  bestDuoAndNemesis,
  formByPlayer,
  matchOutcome,
  median,
  peakRating,
  ratingChangeSince,
  recentForm,
  shareBeaten,
  streakLabel,
} from './player-stats';
import type { MatchResponse } from '@/api-v3';

let seq = 0;
function match(
  winners: string[],
  losers: string[],
  playedAt = '2026-01-01T12:00:00Z',
  delta = 10
): MatchResponse {
  seq += 1;
  const team = (ids: string[], index: number, isWinner: boolean) => ({
    id: `t${seq}-${index}`,
    index,
    score: isWinner ? 10 : 5,
    isWinner,
    players: ids.map((leaguePlayerId, i) => ({
      id: `${leaguePlayerId}-${seq}`,
      leaguePlayerId,
      username: leaguePlayerId,
      index: i,
      ratingDelta: isWinner ? delta : -delta,
    })),
  });
  return {
    id: `m${seq}`,
    leagueId: 'l',
    seasonId: 's',
    source: 'Manual' as MatchResponse['source'],
    playedAt,
    recordedAt: playedAt,
    createdAt: playedAt,
    teams: [team(winners, 0, true), team(losers, 1, false)],
  };
}

describe('matchOutcome', () => {
  it('reads the match from the given player', () => {
    const m = match(['a', 'b'], ['c', 'd'], undefined, 12);
    expect(matchOutcome(m, 'c')).toMatchObject({ won: false, delta: -12 });
    expect(matchOutcome(m, 'a')?.otherTeam.index).toBe(1);
    expect(matchOutcome(m, 'z')).toBeNull();
    expect(matchOutcome(m, null)).toBeNull();
  });
});

describe('recentForm', () => {
  it('returns the newest results oldest first and skips foreign matches', () => {
    const newestFirst = [
      match(['a'], ['b']),
      match(['b'], ['a']),
      match(['c'], ['d']),
      match(['a'], ['c']),
    ];
    expect(recentForm(newestFirst, 'a')).toEqual(['W', 'L', 'W']);
    expect(recentForm(newestFirst, 'a', 2)).toEqual(['L', 'W']);
  });
});

describe('streakLabel', () => {
  it('prefers the active streak', () => {
    expect(streakLabel({ winningStreak: 4, losingStreak: 0 })).toBe('W4');
    expect(streakLabel({ winningStreak: 0, losingStreak: 2 })).toBe('L2');
    expect(streakLabel({ winningStreak: 0, losingStreak: 0 })).toBeNull();
  });
});

describe('bestDuoAndNemesis', () => {
  it('needs a minimum sample and a winning or losing record', () => {
    const matches = [
      match(['a', 'b'], ['c', 'd']),
      match(['a', 'b'], ['c', 'e']),
      match(['c', 'd'], ['a', 'b']),
      match(['c', 'e'], ['a', 'f']),
      match(['c', 'd'], ['a', 'f']),
      match(['a', 'f'], ['d', 'e']),
    ];
    const { duo, nemesis } = bestDuoAndNemesis(matches, 'a');
    expect(duo).toMatchObject({ leaguePlayerId: 'b', wins: 2, losses: 1 });
    expect(nemesis).toMatchObject({ leaguePlayerId: 'c', wins: 2, losses: 3 });
  });

  it('returns nothing below the sample size', () => {
    const { duo, nemesis } = bestDuoAndNemesis(
      [match(['a', 'b'], ['c', 'd'])],
      'a'
    );
    expect(duo).toBeNull();
    expect(nemesis).toBeNull();
  });
});

describe('shareBeaten and median', () => {
  it('counts strictly lower values', () => {
    expect(shareBeaten(5, [1, 5, 7, 3])).toBe(0.5);
    expect(shareBeaten(5, [])).toBe(0);
  });

  it('handles odd, even and empty input', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('rating helpers', () => {
  const points = [
    { mmr: 1000, playedAt: '2026-01-01T00:00:00Z' },
    { mmr: 1100, playedAt: '2026-01-05T00:00:00Z' },
    { mmr: 1050, playedAt: '2026-01-09T00:00:00Z' },
    { mmr: 1080, playedAt: '2026-01-10T00:00:00Z' },
  ];

  it('measures the change against the last rating before the window', () => {
    expect(ratingChangeSince(points, Date.parse('2026-01-08T00:00:00Z'))).toBe(
      -20
    );
    expect(ratingChangeSince(points, Date.parse('2025-12-01T00:00:00Z'))).toBe(
      80
    );
    expect(ratingChangeSince(points, Date.parse('2026-02-01T00:00:00Z'))).toBe(
      0
    );
    expect(ratingChangeSince([], 0)).toBeNull();
  });

  it('finds the peak', () => {
    expect(peakRating(points)?.mmr).toBe(1100);
    expect(peakRating([])).toBeNull();
  });
});

describe('formByPlayer', () => {
  it("keeps each player's newest results, oldest first", () => {
    const newestFirst = [
      match(['a'], ['b']),
      match(['b'], ['a']),
      match(['b'], ['c']),
    ];
    const form = formByPlayer(newestFirst, 2);
    expect(form.get('a')).toEqual(['L', 'W']);
    expect(form.get('b')).toEqual(['W', 'L']);
    expect(form.get('c')).toEqual(['L']);
  });
});
