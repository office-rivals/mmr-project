import { describe, expect, it } from 'vitest';
import {
  bestDuoAndNemesis,
  bestRatingDay,
  changeSince,
  filterByPartners,
  formByPlayer,
  formWins,
  matchOutcome,
  median,
  partnerOptions,
  peakRating,
  profileRecords,
  ratingChangeSince,
  recentForm,
  shareBeaten,
  streakLabel,
  topPercent,
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

describe('profileRecords', () => {
  it('finds the longest win run, the widest win and per-match scoring', () => {
    const oldestFirst = [
      match(['a', 'b'], ['c', 'd']),
      match(['a', 'b'], ['c', 'd']),
      match(['c', 'd'], ['a', 'b']),
      match(['a', 'c'], ['b', 'd']),
    ];
    oldestFirst[1].teams[1].score = 0;
    const records = profileRecords([...oldestFirst].reverse(), 'a');
    expect(records.longestWinStreak).toMatchObject({
      length: 2,
      lastMatch: oldestFirst[1],
    });
    expect(records.biggestWin).toMatchObject({ for: 10, against: 0 });
    expect(records.shutouts).toBe(1);
    expect(records.goalsFor).toBeCloseTo((10 + 10 + 5 + 10) / 4);
    expect(records.goalsAgainst).toBeCloseTo((5 + 0 + 10 + 5) / 4);
  });

  it('is empty for a player without matches', () => {
    expect(profileRecords([], 'a')).toMatchObject({
      longestWinStreak: null,
      biggestWin: null,
      goalsFor: null,
      shutouts: 0,
    });
  });
});

describe('bestRatingDay', () => {
  it('sums the deltas per day and keeps the best gain', () => {
    const matches = [
      match(['a'], ['b'], '2026-01-02T10:00:00Z', 8),
      match(['a'], ['b'], '2026-01-02T12:00:00Z', 9),
      match(['a'], ['b'], '2026-01-01T12:00:00Z', 15),
      match(['b'], ['a'], '2026-01-03T12:00:00Z', 30),
    ];
    const best = bestRatingDay(matches, 'a', (at) => at.slice(0, 10));
    expect(best).toMatchObject({ key: '2026-01-02', delta: 17 });
  });
});

describe('topPercent', () => {
  it('rounds to a whole percent with a floor of one', () => {
    expect(topPercent(4, 24)).toBe(17);
    expect(topPercent(1, 500)).toBe(1);
    expect(topPercent(10, 10)).toBe(100);
  });

  it('is null without a rank or ranked players', () => {
    expect(topPercent(0, 10)).toBeNull();
    expect(topPercent(3, 0)).toBeNull();
  });
});

describe('changeSince', () => {
  it('sums deltas and counts games from the cutoff on', () => {
    const matches = [
      match(['a', 'b'], ['c', 'd'], '2026-01-08T12:00:00Z', 12),
      match(['c', 'a'], ['b', 'd'], '2026-01-07T12:00:00Z', 5),
      match(['a', 'b'], ['c', 'd'], '2025-12-20T12:00:00Z', 30),
    ];
    const changes = changeSince(matches, Date.parse('2026-01-01T00:00:00Z'));
    expect(changes.get('a')).toEqual({ delta: 17, games: 2 });
    expect(changes.get('d')).toEqual({ delta: -17, games: 2 });
    expect(changes.has('z')).toBe(false);
  });

  it('keeps the delta unknown when no match reported one', () => {
    const m = match(['a'], ['b'], '2026-01-08T12:00:00Z');
    for (const team of m.teams)
      for (const p of team.players) p.ratingDelta = undefined;
    expect(changeSince([m], 0).get('a')).toEqual({ delta: null, games: 1 });
  });
});

describe('formWins', () => {
  it('counts wins and treats missing form as none', () => {
    expect(formWins(['W', 'L', 'W'])).toBe(2);
    expect(formWins(undefined)).toBe(0);
  });
});

describe('partnerOptions', () => {
  it('counts teammates and opponents separately, most frequent first', () => {
    const matches = [
      match(['a', 'b'], ['c', 'd']),
      match(['c', 'd'], ['a', 'b']),
      match(['a', 'c'], ['b', 'd']),
    ];
    const { teammates, opponents } = partnerOptions(matches, 'a');
    expect(teammates.map((t) => [t.leaguePlayerId, t.games])).toEqual([
      ['b', 2],
      ['c', 1],
    ]);
    expect(opponents.map((o) => [o.leaguePlayerId, o.games])).toEqual([
      ['d', 3],
      ['c', 2],
      ['b', 1],
    ]);
  });
});

describe('filterByPartners', () => {
  const matches = [
    match(['a', 'b'], ['c', 'd']),
    match(['a', 'c'], ['b', 'd']),
    match(['b', 'c'], ['d', 'e']),
  ];

  it("keeps matches with the teammate on the player's side", () => {
    expect(filterByPartners(matches, 'a', { withId: 'b' })).toEqual([
      matches[0],
    ]);
  });

  it('combines the teammate and the opponent', () => {
    expect(
      filterByPartners(matches, 'a', { withId: 'c', againstId: 'b' })
    ).toEqual([matches[1]]);
    expect(filterByPartners(matches, 'a', { againstId: 'd' })).toEqual([
      matches[0],
      matches[1],
    ]);
  });
});
