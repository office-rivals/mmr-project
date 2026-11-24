import type { MatchResponse } from '@/api-v3/models';

const teamsInOrder = (match: MatchResponse) =>
  match.teams.slice().sort((a, b) => a.index - b.index);

/** The score as the match card shows it, team 1 first, e.g. "10-5". */
export function matchScoreLabel(match: MatchResponse): string {
  return teamsInOrder(match)
    .map((team) => team.score)
    .join('-');
}

/**
 * Whether a typed confirmation names this match's score. Spaces and the kind
 * of dash vary by keyboard, so only the numbers and their order must match.
 */
export function confirmsMatchScore(
  input: string,
  match: MatchResponse
): boolean {
  const normalized = input.replace(/\s+/g, '').replace(/[‐-―−]/g, '-');
  return normalized === matchScoreLabel(match);
}

/** Neighbours further apart than this are not flagged as duplicates. */
export const DUPLICATE_WINDOW_MINUTES = 15;

export interface DuplicateCheck {
  sameScore: boolean;
  minutesApart: number;
  sharedPlayers: number;
  totalPlayers: number;
  likely: boolean;
}

const ids = (team: MatchResponse['teams'][number]) =>
  new Set(team.players.map((p) => p.leaguePlayerId));

/**
 * Pairs each team of one match with a team of the other, in order or swapped,
 * and counts the players found on the paired team. A pairing only counts as
 * the same score when every paired team scored the same.
 */
function pairings(reported: MatchResponse, other: MatchResponse) {
  const mine = teamsInOrder(reported);
  const theirs = teamsInOrder(other);
  if (mine.length !== theirs.length) return [];
  return [theirs, theirs.slice().reverse()].map((paired) => ({
    sameScore: mine.every((team, i) => team.score === paired[i].score),
    shared: mine.reduce((sum, team, i) => {
      const pairedIds = ids(paired[i]);
      return (
        sum + team.players.filter((p) => pairedIds.has(p.leaguePlayerId)).length
      );
    }, 0),
  }));
}

/**
 * A re-entered match keeps each side's score and players, sometimes with the
 * teams entered the other way round and, with four or more players, one name
 * wrong. A rematch or a partner swap with the same score is not a duplicate.
 */
export function compareForDuplicate(
  reported: MatchResponse,
  other: MatchResponse
): DuplicateCheck {
  const totalPlayers = reported.teams.reduce(
    (sum, team) => sum + team.players.length,
    0
  );
  const options = pairings(reported, other);
  const scoring = options.filter((option) => option.sameScore);
  const best = (list: typeof options) =>
    Math.max(0, ...list.map((option) => option.shared));
  const sharedPlayers = scoring.length ? best(scoring) : best(options);
  const gapMs = Math.abs(
    Date.parse(reported.playedAt) - Date.parse(other.playedAt)
  );
  const allowedWrong = totalPlayers >= 4 ? 1 : 0;
  return {
    sameScore: scoring.length > 0,
    minutesApart: Math.round(gapMs / 60_000),
    sharedPlayers,
    totalPlayers,
    likely:
      scoring.length > 0 &&
      gapMs <= DUPLICATE_WINDOW_MINUTES * 60_000 &&
      sharedPlayers > 0 &&
      sharedPlayers >= totalPlayers - allowedWrong,
  };
}

/** "4 min", "1 h 45 min", "3 days": how far apart two matches were played. */
export function describeGap(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  return `${Math.round(minutes / (24 * 60))} days`;
}
