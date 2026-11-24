/**
 * Which rows of the standings each view shows. The rows come in the server's
 * order with the server's rank (`V3LeaderboardService`); nothing here sorts or
 * ranks, it only picks.
 */

interface Row {
  leaguePlayerId: string;
  rank: number;
}

/** Rows `start` up to, not including, `end`. */
export interface Span {
  start: number;
  end: number;
}

/**
 * `size` rows with `index` as near the middle as the list allows. Near either
 * end the window slides instead of shrinking, so it keeps its size; without an
 * index (-1) it is the top of the list.
 */
export function centredSpan(length: number, index: number, size: number): Span {
  const count = Math.min(size, length);
  if (index < 0) return { start: 0, end: count };
  const start = Math.min(
    Math.max(index - Math.floor(size / 2), 0),
    length - count
  );
  return { start, end: start + count };
}

/**
 * Home's slice of the standings, centred on the player, and the narrower slice
 * a phone shows (`phone`, relative to `entries`). A player who is not on the
 * board gets the top.
 */
export function homeBoard<T extends Row>(
  ranked: T[],
  me: string | null,
  rows: number,
  phoneRows: number
): { entries: T[]; phone: Span } {
  const index = me ? ranked.findIndex((e) => e.leaguePlayerId === me) : -1;
  const wide = centredSpan(ranked.length, index, rows);
  const narrow = centredSpan(ranked.length, index, phoneRows);
  return {
    entries: ranked.slice(wide.start, wide.end),
    phone: { start: narrow.start - wide.start, end: narrow.end - wide.start },
  };
}

interface NamedRow extends Row {
  username?: string | null;
  displayName?: string | null;
}

/** The players whose username or display name contains `query`, in order. */
export function searchPlayers<T extends NamedRow>(
  entries: T[],
  query: string
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return entries;
  return entries.filter((e) =>
    [e.username, e.displayName].some((name) =>
      name?.toLocaleLowerCase().includes(needle)
    )
  );
}

/**
 * One page of the standings, after an optional name search, plus the player's
 * own row when it isn't on that page. Search keeps each player's real rank and
 * paging applies to the results; `page` is clamped to the pages there are.
 */
export function standingsPage<T extends NamedRow>(
  entries: T[],
  me: string | null,
  query: string,
  page: number,
  pageSize: number
): {
  shown: T[];
  pinned: T | null;
  matches: number;
  page: number;
  pageCount: number;
} {
  const found = searchPlayers(entries, query);
  const pageCount = Math.max(1, Math.ceil(found.length / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const shown = found.slice((current - 1) * pageSize, current * pageSize);
  const mine = me ? entries.find((e) => e.leaguePlayerId === me) : undefined;
  return {
    shown,
    pinned: mine && !shown.includes(mine) ? mine : null,
    matches: found.length,
    page: current,
    pageCount,
  };
}
