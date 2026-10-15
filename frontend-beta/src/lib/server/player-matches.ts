import type { ApiClientV3 } from '@/lib/server/apiClientV3';
import type { MatchResponse } from '@/api-v3/models';

/** How much of a player's season the per-player summaries look at. */
export const PLAYER_SEASON_MATCH_LIMIT = 1000;

/**
 * A player's season matches, newest first. Home and Profile both summarise
 * this window, so their duo and nemesis callouts agree.
 */
export function fetchPlayerSeasonMatches(
  apiClientV3: ApiClientV3,
  orgId: string,
  leagueId: string,
  seasonId: string | undefined,
  leaguePlayerId: string
): Promise<MatchResponse[]> {
  return apiClientV3.matchesApi.getMatches(orgId, leagueId, {
    seasonId,
    leaguePlayerId,
    limit: PLAYER_SEASON_MATCH_LIMIT,
    offset: 0,
  });
}
