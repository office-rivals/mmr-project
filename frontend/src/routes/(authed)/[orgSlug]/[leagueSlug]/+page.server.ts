import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { matchFlagActions } from '$lib/server/actions/matchFlagActions';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
  url,
}) => {
  const { orgId, leagueId } = await parent();
  const urlSeasonId = url.searchParams.get('season') ?? undefined;

  try {
    const seasons = await apiClientV3.seasonsApi.listSeasons(orgId, leagueId);
    const currentSeason = seasons[0] ?? null;
    const seasonId = urlSeasonId ?? currentSeason?.id;
    const isCurrentSeason =
      urlSeasonId == null || urlSeasonId === currentSeason?.id;

    const ratingHistoryPromise = apiClientV3.ratingHistoryApi
      .getLeagueHistory(orgId, leagueId, seasonId)
      .catch(() => ({ entries: [] }));

    const [leaderboard, matches, players, queueStatus, myFlags] =
      await Promise.all([
        apiClientV3.leaderboardApi.getLeaderboard(orgId, leagueId, seasonId),
        apiClientV3.matchesApi.getMatches(orgId, leagueId, {
          seasonId,
          limit: 5,
          offset: 0,
        }),
        apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
        apiClientV3.queueApi.getQueueStatus(orgId, leagueId).catch(() => null),
        apiClientV3.matchFlagsApi.getMyFlags(orgId, leagueId).catch(() => []),
      ]);

    return {
      leaderboard,
      ratingHistoryPromise,
      recentMatches: matches,
      seasons,
      currentSeason,
      isCurrentSeason,
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
