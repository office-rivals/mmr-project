import { MatchSource } from '@/api-v3/models';
import type { MatchResponse, MatchTeamPlayerResponse } from '@/api-v3/models';
import type { MatchGoalResponse } from './api';

const playerName = (p: { displayName?: string; username?: string }) =>
  p.username ?? p.displayName ?? 'Unknown';

const teamPlayers = (match: MatchResponse, index: number) =>
  match.teams.find((t) => t.index === index)?.players ?? [];

/**
 * Who can be picked for a goal: the credited team's players, or the other
 * team's for an own goal (the score never changes, as on the scoreboard).
 */
export function scorerOptions(match: MatchResponse, goal: MatchGoalResponse) {
  return {
    scored: teamPlayers(match, goal.teamIndex),
    ownGoal: teamPlayers(match, 1 - goal.teamIndex),
  };
}

/** Kept light on purpose: own goals happen to everyone. */
export const ownGoalLabel = (name: string) => `Oops, own goal by ${name}`;

export function scorerLabel(match: MatchResponse, goal: MatchGoalResponse) {
  if (!goal.scorerLeaguePlayerId) return null;
  const player = match.teams
    .flatMap((t) => t.players)
    .find(
      (p: MatchTeamPlayerResponse) =>
        p.leaguePlayerId === goal.scorerLeaguePlayerId
    );
  const name = player ? playerName(player) : 'Unknown';
  return goal.ownGoal ? ownGoalLabel(name) : name;
}

/** "m:ss" since the first goal (the match has no kick-off time). */
export function sinceFirstGoal(at: string, firstAt: string) {
  const s = Math.max(
    0,
    Math.round((Date.parse(at) - Date.parse(firstAt)) / 1000)
  );
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The match page with its goal list, for table-scored matches only. */
export const goalsHref = (
  match: MatchResponse,
  orgSlug: string,
  leagueSlug: string
) =>
  match.source === MatchSource.Table
    ? `/${orgSlug}/${leagueSlug}/match/${match.id}`
    : undefined;

export { playerName };
