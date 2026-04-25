import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId } = await parent();

  const [recentMatches, openFlags, currentSeason, players] = await Promise.all([
    apiClientV3.matchesApi.getMatches(orgId, leagueId, { limit: 5 }),
    apiClientV3.adminMatchFlagsApi
      .listAllFlags(orgId, leagueId, 'Open' as never)
      .catch(() => []),
    apiClientV3.seasonsApi.getCurrentSeason(orgId, leagueId).catch(() => null),
    apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
  ]);

  return {
    recentMatches,
    openFlagsCount: openFlags.length,
    currentSeason,
    playerCount: players.length,
  };
};
