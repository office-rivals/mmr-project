import { describe, it, expect } from 'vitest';
import { movePlayerToTopLeft } from './move-player-to-top-left';
import type { MatchResponse } from '@/api-v3/models';

const player = (id: string, index: number) => ({
  id: `mtp-${id}`,
  leaguePlayerId: id,
  index,
});

const match = (): MatchResponse =>
  ({
    id: 'match-1',
    leagueId: 'league-1',
    seasonId: 'season-1',
    source: 'Manual',
    playedAt: '2026-06-12T18:00:00Z',
    recordedAt: '2026-06-12T18:01:00Z',
    createdAt: '2026-06-12T18:01:00Z',
    teams: [
      {
        id: 'team-a',
        index: 0,
        score: 10,
        isWinner: true,
        players: [player('alice', 0), player('bob', 1)],
      },
      {
        id: 'team-b',
        index: 1,
        score: 4,
        isWinner: false,
        players: [player('carol', 0), player('dave', 1)],
      },
    ],
  }) as MatchResponse;

describe('movePlayerToTopLeft', () => {
  it('moves the player to the first slot of the first team', () => {
    const result = movePlayerToTopLeft(match(), 'dave');

    expect(result.teams[0].id).toBe('team-b');
    expect(result.teams[0].index).toBe(0);
    expect(result.teams[0].players.map((p) => p.leaguePlayerId)).toEqual([
      'dave',
      'carol',
    ]);
    expect(result.teams[1].id).toBe('team-a');
    expect(result.teams[1].index).toBe(1);
  });

  it('rewrites player indices to the new array positions', () => {
    const result = movePlayerToTopLeft(match(), 'bob');

    expect(result.teams[0].players.map((p) => p.index)).toEqual([0, 1]);
    expect(result.teams[0].players[0].leaguePlayerId).toBe('bob');
  });

  it('leaves the other team players untouched', () => {
    const result = movePlayerToTopLeft(match(), 'bob');

    expect(result.teams[1].players.map((p) => p.leaguePlayerId)).toEqual([
      'carol',
      'dave',
    ]);
    expect(result.teams[1].players.map((p) => p.index)).toEqual([0, 1]);
  });

  it('returns the match unchanged when the player is not in it', () => {
    const original = match();
    expect(movePlayerToTopLeft(original, 'nobody')).toBe(original);
  });

  it('does not mutate the input match', () => {
    const original = match();
    movePlayerToTopLeft(original, 'dave');

    expect(original.teams[0].id).toBe('team-a');
    expect(original.teams[0].players[0].leaguePlayerId).toBe('alice');
  });

  it('handles a malformed match with a single team', () => {
    const single = match();
    single.teams = [single.teams[0]];

    const result = movePlayerToTopLeft(single, 'bob');
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].players[0].leaguePlayerId).toBe('bob');
  });
});
