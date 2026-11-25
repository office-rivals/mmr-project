import { describe, it, expect } from 'vitest';
import {
  compareForDuplicate,
  confirmsMatchScore,
  describeGap,
  matchScoreLabel,
} from './match-review';
import type { MatchResponse } from '@/api-v3/models';

const player = (id: string, index: number) => ({
  id: `mtp-${id}`,
  leaguePlayerId: id,
  index,
});

const match = (
  playedAt: string,
  [first, second]: [string[], string[]],
  [firstScore, secondScore]: [number, number]
): MatchResponse =>
  ({
    id: `match-${playedAt}`,
    leagueId: 'league-1',
    seasonId: 'season-1',
    source: 'Manual',
    playedAt,
    recordedAt: playedAt,
    createdAt: playedAt,
    // Listed out of index order on purpose: the card orders by index.
    teams: [
      {
        id: 'team-b',
        index: 1,
        score: secondScore,
        isWinner: secondScore > firstScore,
        players: second.map(player),
      },
      {
        id: 'team-a',
        index: 0,
        score: firstScore,
        isWinner: firstScore > secondScore,
        players: first.map(player),
      },
    ],
  }) as MatchResponse;

const reported = match(
  '2026-10-30T11:35:00Z',
  [
    ['epd', 'jsch'],
    ['mhj', 'msn'],
  ],
  [10, 5]
);

describe('matchScoreLabel', () => {
  it('reads team 1 first, as the match card does', () => {
    expect(matchScoreLabel(reported)).toBe('10-5');
  });
});

describe('confirmsMatchScore', () => {
  it.each(['10-5', ' 10 - 5 ', '10–5', '10—5', '10−5'])(
    'accepts %j',
    (input) => {
      expect(confirmsMatchScore(input, reported)).toBe(true);
    }
  );

  it.each(['', '10', '5-10', '10-6', '105', 'delete'])(
    'rejects %j',
    (input) => {
      expect(confirmsMatchScore(input, reported)).toBe(false);
    }
  );
});

describe('compareForDuplicate', () => {
  it('flags the same score with one player swapped, minutes apart', () => {
    const before = match(
      '2026-10-30T11:31:00Z',
      [
        ['epd', 'kh'],
        ['mhj', 'msn'],
      ],
      [10, 5]
    );
    expect(compareForDuplicate(reported, before)).toEqual({
      sameScore: true,
      minutesApart: 4,
      sharedPlayers: 3,
      totalPlayers: 4,
      likely: true,
    });
  });

  it('flags a re-entry with the teams the other way round', () => {
    const swapped = match(
      '2026-10-30T11:40:00Z',
      [
        ['mhj', 'msn'],
        ['epd', 'jsch'],
      ],
      [5, 10]
    );
    expect(compareForDuplicate(reported, swapped).likely).toBe(true);
  });

  it('does not flag a different score', () => {
    const other = match(
      '2026-10-30T11:31:00Z',
      [
        ['epd', 'jsch'],
        ['mhj', 'msn'],
      ],
      [10, 6]
    );
    expect(compareForDuplicate(reported, other).likely).toBe(false);
  });

  it('does not flag two players changed', () => {
    const other = match(
      '2026-10-30T11:31:00Z',
      [
        ['epd', 'kh'],
        ['mhj', 'ab'],
      ],
      [10, 5]
    );
    expect(compareForDuplicate(reported, other).likely).toBe(false);
  });

  it('does not flag a match outside the window', () => {
    const later = match(
      '2026-10-30T11:51:00Z',
      [
        ['epd', 'jsch'],
        ['mhj', 'msn'],
      ],
      [10, 5]
    );
    const check = compareForDuplicate(reported, later);
    expect(check.minutesApart).toBe(16);
    expect(check.likely).toBe(false);
  });

  it('does not flag a rematch the other side won', () => {
    const rematch = match(
      '2026-10-30T11:40:00Z',
      [
        ['mhj', 'msn'],
        ['epd', 'jsch'],
      ],
      [10, 5]
    );
    expect(compareForDuplicate(reported, rematch)).toMatchObject({
      sameScore: true,
      likely: false,
    });
  });

  it('does not flag the same four with partners swapped', () => {
    const rotated = match(
      '2026-10-30T11:40:00Z',
      [
        ['epd', 'mhj'],
        ['jsch', 'msn'],
      ],
      [10, 5]
    );
    expect(compareForDuplicate(reported, rotated).likely).toBe(false);
  });

  it('flags a 1v1 re-entry only with the same two players', () => {
    const single = (at: string, a: string, b: string) =>
      match(at, [[a], [b]], [10, 5]);
    const base = single('2026-10-30T11:35:00Z', 'epd', 'jsch');
    expect(
      compareForDuplicate(base, single('2026-10-30T11:30:00Z', 'epd', 'jsch'))
        .likely
    ).toBe(true);
    expect(
      compareForDuplicate(base, single('2026-10-30T11:30:00Z', 'epd', 'kh'))
        .likely
    ).toBe(false);
  });

  it('measures the window to the second, not to the rounded minute', () => {
    const at = (time: string) =>
      match(
        time,
        [
          ['epd', 'kh'],
          ['mhj', 'msn'],
        ],
        [10, 5]
      );
    expect(
      compareForDuplicate(reported, at('2026-10-30T11:50:00Z')).likely
    ).toBe(true);
    const late = compareForDuplicate(reported, at('2026-10-30T11:50:29Z'));
    expect(late.minutesApart).toBe(15);
    expect(late.likely).toBe(false);
  });
});

describe('describeGap', () => {
  it.each([
    [0, '0 min'],
    [4, '4 min'],
    [60, '1 h'],
    [105, '1 h 45 min'],
    [47 * 60, '47 h'],
    [3 * 24 * 60, '3 days'],
  ])('%i minutes reads %j', (minutes, text) => {
    expect(describeGap(minutes)).toBe(text);
  });
});
