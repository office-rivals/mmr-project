import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ClaimForm,
  pickClaimMatch,
  chipPlayers,
  slotsFromMatch,
  toPlayerRequest,
} from './claim-form';
import type { LeaguePlayerResponse } from '@/api-v3';
import type { TableMatchResponse, TableResponse } from './api';

const table: TableResponse = {
  id: 't1',
  name: 'Table 1',
  leagueId: 'l1',
  endLabelA: 'Window',
  endLabelB: 'Door',
  scoreboardLeftEnd: 'B',
  hasScoreboard: true,
  soundVolume: 2,
  shortCode: 'ABCDEFGHJK',
  createdAt: '2026-10-14T00:00:00Z',
  occupancy: {
    status: 'Free',
    since: null,
    reason: null,
    scoreA: null,
    scoreB: null,
    rosterCount: null,
    rosterSize: null,
  },
};
const match = { id: 'm1', scoreA: 10, scoreB: 7 } as TableMatchResponse;
const player = (id: string) =>
  ({ id, displayName: `Player ${id}` }) as LeaguePlayerResponse;
const players = ['p1', 'p2', 'p3', 'p4'].map(player);

const render = (teamSize: number, previousMatch: TableMatchResponse | null) =>
  renderToStaticMarkup(
    <ClaimForm
      table={table}
      match={match}
      previousMatch={previousMatch}
      leagueId="l1"
      teamSize={teamSize}
      myLeaguePlayerId="p1"
      players={players}
      members={[]}
      submitting={false}
      onSubmit={() => {}}
    />
  );

describe('ClaimForm', () => {
  it('follows the league team size, labelled by table end', () => {
    const doubles = render(2, null);
    for (const label of [
      'Window player 1',
      'Window player 2',
      'Door player 1',
      'Door player 2',
    ])
      expect(doubles).toContain(label);

    const singles = render(1, null);
    expect(singles).toContain('Door player 1');
    expect(singles).not.toContain('player 2');
  });

  it('puts the scoreboard-left end first and offers a "Me" chip', () => {
    const markup = render(2, null);
    expect(markup.indexOf('Door player 1')).toBeLessThan(
      markup.indexOf('Window player 1')
    );
    expect(markup).toContain('>Me<');
  });

  it('offers "Same players" only when the last line-up fits', () => {
    const previous = {
      playersA: [{ leaguePlayerId: 'p1' }, { leaguePlayerId: 'p2' }],
      playersB: [{ leaguePlayerId: 'p3' }, { leaguePlayerId: 'p4' }],
    } as TableMatchResponse;
    expect(render(2, previous)).toContain('Same players as last game');
    expect(render(1, previous)).not.toContain('Same players');
  });
});

describe('chipPlayers', () => {
  it('lists me first, then recents, skipping placed and unknown players', () => {
    expect(
      chipPlayers(players, 'p1', ['p3', 'gone', 'p1', 'p2'], ['p2']).map(
        (p) => p.id
      )
    ).toEqual(['p1', 'p3']);
  });

  it('caps at six', () => {
    const many = Array.from({ length: 9 }, (_, i) => player(`x${i}`));
    expect(
      chipPlayers(
        many,
        null,
        many.map((p) => p.id),
        []
      )
    ).toHaveLength(6);
  });
});

describe('slotsFromMatch', () => {
  it('rejects a line-up with a player outside the league', () => {
    const previous = {
      playersA: [{ leaguePlayerId: 'p1' }],
      playersB: [{ leaguePlayerId: 'other-league' }],
    } as TableMatchResponse;
    expect(slotsFromMatch(previous, players, 1)).toBeNull();
  });

  it('maps a fitting line-up to league slots', () => {
    const previous = {
      playersA: [{ leaguePlayerId: 'p1' }],
      playersB: [{ leaguePlayerId: 'p2' }],
    } as TableMatchResponse;
    expect(slotsFromMatch(previous, players, 1)).toEqual({
      A: [{ kind: 'league', player: players[0] }],
      B: [{ kind: 'league', player: players[1] }],
    });
  });
});

it('maps picker slots to submit-match player refs', () => {
  expect(toPlayerRequest({ kind: 'league', player: player('p1') })).toEqual({
    leaguePlayerId: 'p1',
  });
  expect(
    toPlayerRequest({ kind: 'member', member: { id: 'm1' } as never })
  ).toEqual({ organizationMembershipId: 'm1' });
  expect(
    toPlayerRequest({ kind: 'new', displayName: 'Ny', username: '', email: '' })
  ).toEqual({
    newPlayer: { displayName: 'Ny', username: undefined, email: undefined },
  });
});

describe('pickClaimMatch', () => {
  const m = (id: string, extra: Partial<TableMatchResponse> = {}) =>
    ({
      id,
      status: 'Finished',
      scoreA: 10,
      scoreB: 7,
      ...extra,
    }) as TableMatchResponse;
  const running = m('live', { status: 'Live', scoreA: 3, scoreB: 2 });

  it('takes the requested match only if it is still claimable', () => {
    expect(pickClaimMatch([m('a'), m('b')], null, 'b')?.id).toBe('b');
    expect(pickClaimMatch([m('a')], null, 'gone')).toBeNull();
  });

  it('defaults to the newest claimable, then the unlinked running game', () => {
    expect(pickClaimMatch([m('a'), m('b')], running, undefined)?.id).toBe('a');
    expect(pickClaimMatch([], running, undefined)?.id).toBe('live');
    expect(pickClaimMatch([], running, 'live')?.id).toBe('live');
  });

  it('never offers a linked or scoreless running game', () => {
    expect(
      pickClaimMatch([], { ...running, activeMatchId: 'am1' }, undefined)
    ).toBeNull();
    expect(
      pickClaimMatch([], { ...running, scoreA: 0, scoreB: 0 }, undefined)
    ).toBeNull();
  });
});
