import { describe, expect, it } from 'vitest';
import {
  formatMmrChange,
  formatStake,
  matchOdds,
  stakeLabel,
} from './match-prediction';
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
    expect(matchOdds(prediction, 'someone-else')?.placement).toBe(false);
  });

  it('hides a placing player’s stake and their team’s average', () => {
    const placing: MatchPredictionResponse = {
      teams: [
        {
          ...prediction.teams[0],
          players: [
            { leaguePlayerId: 'c', mmr: null, mmrIfWin: null, mmrIfLose: null },
            prediction.teams[0].players[1],
          ],
        },
        prediction.teams[1],
      ],
    };

    const theirs = matchOdds(placing, 'c');
    expect(theirs?.stake).toBeNull();
    expect(theirs?.placement).toBe(true);
    expect(theirs?.teams.map((t) => t.averageMmr)).toEqual([1693, null]);
    // A placed teammate keeps their own stake.
    expect(matchOdds(placing, 'd')?.stake).toEqual({ win: 14, lose: -10 });
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

describe('stakeLabel', () => {
  const odds = matchOdds(prediction, 'a')!;

  it('names a placement match instead of its stake', () => {
    expect(stakeLabel(odds)).toBe('Win +11 · Lose −13');
    expect(stakeLabel({ ...odds, stake: null, placement: true })).toBe(
      'Placement match'
    );
    expect(stakeLabel({ ...odds, stake: null })).toBeNull();
  });
});
