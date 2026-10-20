import { SILENT_AFTER_MS } from './format';
import type {
  LiveDevice,
  TableEnd,
  TableMatchResponse,
  TablePlayerResponse,
  TableResponse,
} from './api';

type Scores = Pick<TableMatchResponse, 'scoreA' | 'scoreB'>;

export const nameOf = (p: TablePlayerResponse) =>
  p.displayName ?? p.username ?? '?';

/** The scoreboard's order; without a board A (Red by default) left. */
export const columns = (table: TableResponse): TableEnd[] =>
  table.scoreboardLeftEnd === 'B' ? ['B', 'A'] : ['A', 'B'];

/**
 * The team's name: the admin's per-table names (default Red / White). Team A
 * defends goal A, so the counter in goal A counts team B's goals.
 */
export const endLabel = (table: TableResponse, end: TableEnd) =>
  end === 'A' ? table.endLabelA : table.endLabelB;

export const otherEnd = (end: TableEnd): TableEnd => (end === 'A' ? 'B' : 'A');

export const scoreOf = (m: Scores, end: TableEnd) =>
  end === 'A' ? m.scoreA : m.scoreB;

/** "3 : 2", left : right in column order. */
const scoreText = (table: TableResponse, m: Scores) =>
  columns(table)
    .map((end) => scoreOf(m, end))
    .join(' : ');

/** The finished game's winner, for the check mark. */
export function winner(match: TableMatchResponse | null): TableEnd | null {
  if (!match || (match.status !== 'Finished' && match.status !== 'Submitted'))
    return null;
  if (match.scoreA === match.scoreB) return null;
  return match.scoreA > match.scoreB ? 'A' : 'B';
}

/** The one line under the score (ux Part A2.3). */
export function statusLine(
  table: TableResponse,
  match: TableMatchResponse | null,
  winningScore: number | null,
  now: number
) {
  if (!match || match.status === 'Discarded')
    return 'No game running. The next goal starts one.';
  if (match.status === 'Live') {
    // Whole minutes only: the game runs on goals, not on a clock.
    const min = Math.max(
      0,
      Math.floor((now - Date.parse(match.startedAt)) / 60_000)
    );
    return winningScore == null
      ? `${min} min`
      : `First to ${winningScore} · ${min} min`;
  }
  if (match.status === 'Submitted') return 'Saved to MMR';
  if (match.autoSubmitAt) {
    const s = Math.ceil((Date.parse(match.autoSubmitAt) - now) / 1000);
    return s > 0 ? `Game over · saving in ${s} s` : 'Game over · saving…';
  }
  const won = winner(match);
  return won ? `Game over · ${endLabel(table, won)} won` : 'Game over';
}

/** "Goal for White · 20 s ago · Anna"; after 5 min "Last goal 14:07". */
export function lastGoalText(
  table: TableResponse,
  match: TableMatchResponse | null,
  now: number,
  formatTime: (iso: string) => string
) {
  const goal = match?.lastGoal;
  if (!goal) return null;
  const age = now - Date.parse(goal.occurredAt);
  if (age >= 5 * 60_000) return `Last goal ${formatTime(goal.occurredAt)}`;
  // The age moves in 10 s steps, so the line doesn't tick.
  const ago =
    age < 10_000
      ? 'just now'
      : age < 60_000
        ? `${Math.floor(age / 10_000) * 10} s ago`
        : `${Math.floor(age / 60_000)} min ago`;
  const scorer = [...match.playersA, ...match.playersB].find(
    (p) => p.leaguePlayerId === goal.scorerLeaguePlayerId
  );
  return [
    `Goal for ${endLabel(table, goal.end)}`,
    ago,
    scorer && nameOf(scorer),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Goal for White undone · now 2 : 3", the new score in column order. */
export const undoneText = (
  table: TableResponse,
  end: TableEnd,
  match: Scores
) => `Goal for ${endLabel(table, end)} undone · now ${scoreText(table, match)}`;

export type LiveChange = { type: 'goal' | 'undo'; end: TableEnd };

/** What changed between two answers: a goal (which end) or an undo. */
export function liveChange(
  prev: TableMatchResponse | null,
  next: TableMatchResponse | null
): LiveChange | null {
  if (!next) return null;
  const same = prev?.id === next.id;
  // A new match starts with its first goal.
  if (!same && next.status !== 'Live') return null;
  const base = same ? prev : { scoreA: 0, scoreB: 0 };
  const dA = next.scoreA - base.scoreA;
  const dB = next.scoreB - base.scoreB;
  if (same && dA < 0 && dB === 0) return { type: 'undo', end: 'A' };
  if (same && dB < 0 && dA === 0) return { type: 'undo', end: 'B' };
  if (dA > 0 && dB === 0) return { type: 'goal', end: 'A' };
  if (dB > 0 && dA === 0) return { type: 'goal', end: 'B' };
  return null;
}

/**
 * Why goals may have stopped counting, for the players (offline, low
 * battery, a stuck ball). A counter is named by the goalkeeper in front of
 * it: "Goal counter behind the Red goalkeeper: battery low".
 */
export function deviceTroubleLines(
  table: TableResponse,
  devices: LiveDevice[],
  now: number
) {
  return devices.flatMap((d) => {
    const seen = d.lastSeenAt ? Date.parse(d.lastSeenAt) : NaN;
    const offline = !(now - seen < SILENT_AFTER_MS);
    if (d.role === 'Scoreboard')
      return [
        offline && 'The scoreboard is offline',
        d.lowBatt && 'Scoreboard: battery low',
      ].filter((line): line is string => !!line);
    // The counter in goal X sits behind team X's goalkeeper.
    // No possessives: any name works.
    const keeper = d.end
      ? `the ${endLabel(table, d.end)} goalkeeper`
      : 'a goalkeeper';
    return [
      offline && `Goal counter behind ${keeper} is offline`,
      d.beamHealth === 'blocked' && `Ball stuck behind ${keeper}?`,
      d.lowBatt && `Goal counter behind ${keeper}: battery low`,
    ].filter((line): line is string => !!line);
  });
}
