import { openFlagsForLeague } from '$lib/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId, badges } = await parent();

  const [recentMatches, currentSeason, players, hardware] = await Promise.all([
    apiClientV3.matchesApi.getMatches(orgId, leagueId, { limit: 5 }),
    apiClientV3.seasonsApi.getCurrentSeason(orgId, leagueId).catch(() => null),
    apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
    apiClientV3.hardwareApi.listForLeague(orgId, leagueId),
  ]);

  return {
    recentMatches,
    // Sourced from the badges endpoint, same as the other flag badges.
    openFlagsCount: openFlagsForLeague(badges, leagueId),
    currentSeason,
    playerCount: players.length,
    hardware,
  };
};
