import type { MatchResponse } from '@/api-v3/models';

/**
 * Reorders a match so the given league player is the first player of the first
 * team. Used on the player profile so the focused player is always shown
 * top-left of every match card.
 *
 * The rewritten `team.index` / player `index` values are load-bearing:
 * `MatchCard` resolves its two columns by `index === 0` / `index === 1`, so
 * without the rewrite the rotation would be invisible. The other team's player
 * order is deliberately left untouched, and a match the player is not part of
 * is returned unchanged.
 */
export function movePlayerToTopLeft(
  match: MatchResponse,
  leaguePlayerId: string
): MatchResponse {
  const myTeam = match.teams.find((t) =>
    t.players.some((p) => p.leaguePlayerId === leaguePlayerId)
  );
  if (!myTeam) return match;

  const otherTeam = match.teams.find((t) => t !== myTeam);

  const reorderedMyTeamPlayers = [...myTeam.players]
    .sort((a, b) => {
      if (a.leaguePlayerId === leaguePlayerId) return -1;
      if (b.leaguePlayerId === leaguePlayerId) return 1;
      return 0;
    })
    .map((p, i) => ({ ...p, index: i }));

  const newTeams = [
    { ...myTeam, index: 0, players: reorderedMyTeamPlayers },
    ...(otherTeam ? [{ ...otherTeam, index: 1 }] : []),
  ];

  return { ...match, teams: newTeams };
}
