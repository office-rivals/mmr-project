import { describe, expect, it } from 'vitest';
import { formatMmrChange, formatStake, matchOdds } from './match-prediction';
import type { MatchPredictionResponse } from '@/api-v3';

const prediction: MatchPredictionResponse = {
  teams: [
    {
      index: 1,
      winChance: 0.4549,
      players: [
        { leaguePlayerId: 'c', mmr: 1600, mmrIfWin: 1622, mmrIfLose: 1584 },
        { leaguePlayerId: 'd', mmr: 1697, mmrIfWin: 1711, mmrIfLose: 1687 },
      ],
    },
    {
      index: 0,
      winChance: 0.5451,
      players: [
        { leaguePlayerId: 'a', mmr: 1700, mmrIfWin: 1711, mmrIfLose: 1687 },
        { leaguePlayerId: 'b', mmr: 1685, mmrIfWin: 1701, mmrIfLose: 1668 },
      ],
    },
  ],
};

describe('matchOdds', () => {
  it('orders teams by index with whole percentages that add up to 100', () => {
    const odds = matchOdds(prediction, 'a');

    expect(odds?.teams.map((t) => t.index)).toEqual([0, 1]);
    expect(odds?.teams.map((t) => t.winPercent)).toEqual([55, 45]);
  });

  it('averages each team’s MMR going into the match', () => {
    const odds = matchOdds(prediction, 'a');

    expect(odds?.teams.map((t) => t.averageMmr)).toEqual([1693, 1649]);
  });

  it('gives the viewer their own stake', () => {
    expect(matchOdds(prediction, 'a')?.stake).toEqual({ win: 11, lose: -13 });
    expect(matchOdds(prediction, 'c')?.stake).toEqual({ win: 22, lose: -16 });
  });

  it('has no stake for someone who is not playing', () => {
    expect(matchOdds(prediction, 'someone-else')?.stake).toBeNull();
    expect(matchOdds(prediction, null)?.stake).toBeNull();
  });

  it('is null without a usable prediction', () => {
    expect(matchOdds(null, 'a')).toBeNull();
    expect(matchOdds(undefined, 'a')).toBeNull();
    expect(matchOdds({ teams: [prediction.teams[0]] }, 'a')).toBeNull();
    expect(
      matchOdds(
        {
          teams: [prediction.teams[0], { ...prediction.teams[1], players: [] }],
        },
        'a'
      )
    ).toBeNull();
  });
});

describe('formatStake', () => {
  it('signs both changes with a true minus sign', () => {
    expect(formatStake({ win: 11, lose: -13 })).toBe('Win +11 · Lose −13');
    expect(formatMmrChange(0)).toBe('+0');
  });
});
