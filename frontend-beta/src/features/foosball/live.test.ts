import { expect, it } from 'vitest';
import {
  columns,
  deviceTroubleLines,
  lastGoalText,
  liveChange,
  statusLine,
  undoneText,
  winner,
} from './live';
import type { TableMatchResponse, TableResponse } from './api';

const now = Date.parse('2026-10-17T10:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();
const table = {
  endLabelA: 'Red',
  endLabelB: 'White',
  scoreboardLeftEnd: null,
} as TableResponse;
const match = (
  extra: Partial<TableMatchResponse> = {}
): TableMatchResponse => ({
  id: 'm1',
  tableId: 't1',
  status: 'Live',
  startedAt: ago(7.5 * 60_000),
  scoreA: 3,
  scoreB: 2,
  playersA: [{ leaguePlayerId: 'p1', displayName: 'Anna' }],
  playersB: [],
  lastGoal: { id: 'g5', end: 'A', occurredAt: ago(25_000) },
  ...extra,
});
const time = (iso: string) => iso.slice(11, 16);

it('orders the columns A | B without a board, else as the board', () => {
  expect(columns(table)).toEqual(['A', 'B']);
  expect(columns({ ...table, scoreboardLeftEnd: 'B' })).toEqual(['B', 'A']);
});

it('says where the game is', () => {
  expect(statusLine(table, match(), 10, now)).toBe('First to 10 · 7 min');
  expect(statusLine(table, match(), null, now)).toBe('7 min');
  expect(
    statusLine(
      table,
      match({ status: 'Finished', autoSubmitAt: ago(-5_500) }),
      10,
      now
    )
  ).toBe('Game over · saving in 6 s');
  expect(
    statusLine(table, match({ status: 'Finished', scoreA: 2 }), 10, now)
  ).toBe('Game over');
  expect(statusLine(table, match({ status: 'Submitted' }), 10, now)).toBe(
    'Saved to MMR'
  );
  expect(statusLine(table, null, 10, now)).toBe(
    'No game running. The next goal starts one.'
  );
});

it('names the last goal, its age in 10 s steps, and the scorer', () => {
  expect(lastGoalText(table, match(), now, time)).toBe(
    'Goal for Red · 20 s ago'
  );
  const scored = match({
    lastGoal: {
      id: 'g',
      end: 'A',
      scorerLeaguePlayerId: 'p1',
      occurredAt: ago(3_000),
    },
  });
  expect(lastGoalText(table, scored, now, time)).toBe(
    'Goal for Red · just now · Anna'
  );
  const old = match({
    lastGoal: { id: 'g', end: 'B', occurredAt: '2026-10-17T09:50:00Z' },
  });
  expect(lastGoalText(table, old, now, time)).toBe('Last goal 09:50');
});

it('says a goal was undone, in column order', () => {
  expect(undoneText(table, 'B', match())).toBe(
    'Goal for White undone · now 3 : 2'
  );
  expect(undoneText({ ...table, scoreboardLeftEnd: 'B' }, 'A', match())).toBe(
    'Goal for Red undone · now 2 : 3'
  );
});

it('tells a goal from an undo', () => {
  expect(liveChange(match(), match({ scoreB: 3 }))).toEqual({
    type: 'goal',
    end: 'B',
  });
  expect(liveChange(match(), match({ scoreA: 2 }))).toEqual({
    type: 'undo',
    end: 'A',
  });
  expect(liveChange(null, match({ id: 'm2', scoreA: 1, scoreB: 0 }))).toEqual({
    type: 'goal',
    end: 'A',
  });
  expect(liveChange(match(), match())).toBeNull();
  expect(liveChange(match(), null)).toBeNull();
});

it('marks the winner only once the game is over', () => {
  expect(winner(match())).toBeNull();
  expect(winner(match({ status: 'Finished', scoreA: 10 }))).toBe('A');
  expect(
    statusLine(table, match({ status: 'Finished', scoreB: 10 }), 10, now)
  ).toBe('Game over · White won');
});

it('tells the players why goals may not count', () => {
  expect(
    deviceTroubleLines(
      table,
      [
        { end: 'B', role: 'Goal', lowBatt: true, lastSeenAt: ago(60_000) },
        {
          end: 'A',
          role: 'Goal',
          lowBatt: false,
          beamHealth: 'blocked',
          lastSeenAt: ago(60_000),
        },
        { end: 'A', role: 'Goal', lowBatt: false, lastSeenAt: ago(60_000) },
        { role: 'Scoreboard', lowBatt: false, lastSeenAt: ago(40 * 3.6e6) },
      ],
      now
    )
  ).toEqual([
    'Goal counter behind the White goalkeeper: battery low',
    'Ball stuck behind the Red goalkeeper?',
    'The scoreboard is offline',
  ]);
  expect(deviceTroubleLines(table, [], now)).toEqual([]);
});
