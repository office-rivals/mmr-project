import { describe, expect, it } from 'vitest';
import { centredSpan, homeBoard, standingsPage } from './leaderboard-window';

/** Players p1..pN in board order, ranked 1..N unless `ranks` says otherwise. */
function board(count: number, ranks?: number[]) {
  return Array.from({ length: count }, (_, i) => ({
    leaguePlayerId: `p${i + 1}`,
    rank: ranks?.[i] ?? i + 1,
  }));
}
const ids = (rows: { leaguePlayerId: string }[]) =>
  rows.map((r) => r.leaguePlayerId);

describe('centredSpan', () => {
  it('puts the index in the middle, with as many rows above as below', () => {
    expect(centredSpan(39, 14, 7)).toEqual({ start: 11, end: 18 });
  });

  it('slides down near the top so the size stays the same', () => {
    expect(centredSpan(39, 0, 7)).toEqual({ start: 0, end: 7 });
    expect(centredSpan(39, 1, 7)).toEqual({ start: 0, end: 7 });
    expect(centredSpan(39, 3, 7)).toEqual({ start: 0, end: 7 });
    expect(centredSpan(39, 4, 7)).toEqual({ start: 1, end: 8 });
  });

  it('slides up near the bottom so the size stays the same', () => {
    expect(centredSpan(39, 38, 7)).toEqual({ start: 32, end: 39 });
    expect(centredSpan(39, 36, 7)).toEqual({ start: 32, end: 39 });
    expect(centredSpan(39, 34, 7)).toEqual({ start: 31, end: 38 });
  });

  it('is the top of the list when there is no index', () => {
    expect(centredSpan(39, -1, 7)).toEqual({ start: 0, end: 7 });
  });

  it('shows everyone when the list is shorter than the window', () => {
    expect(centredSpan(4, 3, 7)).toEqual({ start: 0, end: 4 });
    expect(centredSpan(0, -1, 7)).toEqual({ start: 0, end: 0 });
  });
});

describe('homeBoard', () => {
  it('centres both the desktop rows and the phone rows on the player', () => {
    const { entries, phone } = homeBoard(board(39), 'p15', 7, 5);
    expect(ids(entries)).toEqual([
      'p12',
      'p13',
      'p14',
      'p15',
      'p16',
      'p17',
      'p18',
    ]);
    expect(ids(entries.slice(phone.start, phone.end))).toEqual([
      'p13',
      'p14',
      'p15',
      'p16',
      'p17',
    ]);
  });

  it('keeps the phone rows inside the desktop rows at either end', () => {
    for (const me of ['p1', 'p2', 'p3', 'p37', 'p38', 'p39']) {
      const { entries, phone } = homeBoard(board(39), me, 7, 5);
      expect(phone.start).toBeGreaterThanOrEqual(0);
      expect(phone.end).toBeLessThanOrEqual(entries.length);
      expect(phone.end - phone.start).toBe(5);
      expect(ids(entries.slice(phone.start, phone.end))).toContain(me);
    }
  });

  it('shows the top when the player is not on the board', () => {
    const { entries, phone } = homeBoard(board(39), 'unranked', 7, 5);
    expect(ids(entries)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
    expect(phone).toEqual({ start: 0, end: 5 });
  });

  it('shows the top when nobody is signed in to the league', () => {
    expect(ids(homeBoard(board(39), null, 7, 5).entries)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
    ]);
  });

  it('shows everyone on a small board', () => {
    const { entries, phone } = homeBoard(board(3), 'p3', 7, 5);
    expect(ids(entries)).toEqual(['p1', 'p2', 'p3']);
    expect(phone).toEqual({ start: 0, end: 3 });
  });
});

describe('standingsPage', () => {
  // Every player in this board has a username, so search can find them.
  const named = (count: number) =>
    board(count).map((row) => ({
      ...row,
      username: `user${row.rank}`,
      displayName: `Player ${row.rank}`,
    }));

  it('shows the first page and pins a player ranked below it', () => {
    const view = standingsPage(named(245), 'p150', '', 1, 100);
    expect(ids(view.shown)).toEqual(ids(named(245).slice(0, 100)));
    expect(view.pageCount).toBe(3);
    expect(view.matches).toBe(245);
    expect(view.pinned?.leaguePlayerId).toBe('p150');
  });

  it('shows the player in place, unpinned, on their own page', () => {
    const view = standingsPage(named(245), 'p150', '', 2, 100);
    expect(view.shown[0].leaguePlayerId).toBe('p101');
    expect(ids(view.shown)).toContain('p150');
    expect(view.pinned).toBeNull();
  });

  it('pins a player ranked above the page shown', () => {
    expect(
      standingsPage(named(245), 'p15', '', 3, 100).pinned?.leaguePlayerId
    ).toBe('p15');
  });

  it('keeps the last page short and clamps a page past the end', () => {
    expect(standingsPage(named(245), null, '', 3, 100).shown).toHaveLength(45);
    expect(standingsPage(named(245), null, '', 9, 100).page).toBe(3);
    expect(standingsPage(named(245), null, '', 0, 100).page).toBe(1);
  });

  it('is one page when everyone fits', () => {
    const view = standingsPage(named(39), 'p31', '', 1, 100);
    expect(view.shown).toHaveLength(39);
    expect(view.pageCount).toBe(1);
    expect(view.pinned).toBeNull();
  });

  it('finds players by username or display name, keeping their ranks', () => {
    const rows = named(245);
    const byUser = standingsPage(rows, null, 'USER14', 1, 100);
    expect(byUser.shown.map((r) => r.rank)).toEqual([
      14, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149,
    ]);
    const byName = standingsPage(rows, null, '  player 7 ', 1, 100);
    expect(byName.shown[0].rank).toBe(7);
  });

  it('pages the search results, not the whole board', () => {
    const view = standingsPage(named(245), null, 'user1', 2, 100);
    // user1, user10-19, user100-199 = 111 matches.
    expect(view.matches).toBe(111);
    expect(view.pageCount).toBe(2);
    expect(view.shown).toHaveLength(11);
  });

  it('pins the player when a search leaves them out', () => {
    const view = standingsPage(named(245), 'p31', 'user7', 1, 100);
    expect(ids(view.shown)).not.toContain('p31');
    expect(view.pinned?.leaguePlayerId).toBe('p31');
  });

  it('shows nothing, with the player still pinned, when no one matches', () => {
    const view = standingsPage(named(39), 'p31', 'nobody', 1, 100);
    expect(view.shown).toEqual([]);
    expect(view.matches).toBe(0);
    expect(view.pageCount).toBe(1);
    expect(view.pinned?.leaguePlayerId).toBe('p31');
  });

  it('pins nobody who is not on the board', () => {
    expect(standingsPage(named(245), 'unranked', '', 1, 100).pinned).toBeNull();
    expect(standingsPage(named(245), null, '', 1, 100).pinned).toBeNull();
  });
});
