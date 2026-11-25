import { describe, expect, it } from 'vitest';
import { goalsHref, scorerLabel, scorerOptions, sinceFirstGoal } from './goals';
import type { MatchResponse } from '@/api-v3/models';
import type { MatchGoalResponse } from './api';

const team = (index: number, ...names: string[]) => ({
  index,
  players: names.map((n) => ({ leaguePlayerId: n, username: n })),
});
const match = {
  teams: [team(1, 'cat', 'dan'), team(0, 'ann', 'bob')],
} as unknown as MatchResponse;
const goal = (extra: Partial<MatchGoalResponse>) =>
  ({
    teamIndex: 0,
    scorerLeaguePlayerId: null,
    ownGoal: false,
    ...extra,
  }) as MatchGoalResponse;

describe('scorerOptions', () => {
  it('offers the credited team, and the other team as own goals', () => {
    const { scored, ownGoal } = scorerOptions(match, goal({ teamIndex: 1 }));
    expect(scored.map((p) => p.leaguePlayerId)).toEqual(['cat', 'dan']);
    expect(ownGoal.map((p) => p.leaguePlayerId)).toEqual(['ann', 'bob']);
  });
});

describe('scorerLabel', () => {
  it('names the scorer, playfully for an own goal, null when unknown', () => {
    expect(scorerLabel(match, goal({ scorerLeaguePlayerId: 'ann' }))).toBe(
      'ann'
    );
    expect(
      scorerLabel(match, goal({ scorerLeaguePlayerId: 'cat', ownGoal: true }))
    ).toBe('Oops, own goal by cat');
    expect(scorerLabel(match, goal({}))).toBeNull();
  });
});

it('formats time since the first goal as m:ss', () => {
  expect(sinceFirstGoal('2026-10-15T10:01:05Z', '2026-10-15T10:00:00Z')).toBe(
    '1:05'
  );
  expect(sinceFirstGoal('2026-10-15T10:00:00Z', '2026-10-15T10:00:00Z')).toBe(
    '0:00'
  );
});

it('links only table-scored matches to their goal list', () => {
  const m = (source: string) => ({ id: 'm1', source }) as MatchResponse;
  expect(goalsHref(m('Table'), 'o', 'l')).toBe('/o/l/match/m1');
  expect(goalsHref(m('Manual'), 'o', 'l')).toBeUndefined();
});
