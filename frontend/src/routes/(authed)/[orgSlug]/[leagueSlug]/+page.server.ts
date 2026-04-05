import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { matchFlagActions } from '$lib/server/actions/matchFlagActions';

export const load: PageServerLoad = async ({ parent, locals: { apiClientV3 }, url }) => {
  const { orgId, leagueId } = await parent();
  const seasonId = url.searchParams.get('season') ?? undefined;

  try {
    const [leaderboard, matches, seasons, players, queueStatus, myFlags] =
      await Promise.all([
        apiClientV3.leaderboardApi.getLeaderboard(orgId, leagueId, seasonId),
        apiClientV3.matchesApi.getMatches(orgId, leagueId, { limit: 5, offset: 0 }),
        apiClientV3.seasonsApi.listSeasons(orgId, leagueId),
        apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
        apiClientV3.queueApi.getQueueStatus(orgId, leagueId).catch(() => null),
        apiClientV3.matchFlagsApi.getMyFlags(orgId, leagueId).catch(() => []),
      ]);

    return {
      leaderboard,
      recentMatches: matches,
      seasons,
      currentSeason: seasons[0] ?? null,
      players,
      queueStatus,
      myFlags,
    };
  } catch {
    throw error(500, 'Failed to load leaderboard');
  }
};

export const actions: Actions = {
  ...matchFlagActions,
};
