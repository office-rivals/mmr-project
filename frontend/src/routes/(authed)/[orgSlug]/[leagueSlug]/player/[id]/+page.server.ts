import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { matchFlagActions } from '$lib/server/actions/matchFlagActions';

export const load: PageServerLoad = async ({ params, parent, locals: { apiClientV3 }, url }) => {
  const { orgId, leagueId, leaguePlayerId, orgSlug, leagueSlug } =
    await parent();
  const playerId = params.id;
  const seasonId = url.searchParams.get('season') ?? undefined;

  try {
    const [player, allMatches, ratingHistory, leaderboard, seasons, myFlags] =
      await Promise.all([
        apiClientV3.leaguePlayersApi.getPlayer(orgId, leagueId, playerId),
        apiClientV3.matchesApi.getMatches(orgId, leagueId, { limit: 1000, offset: 0 }),
        apiClientV3.ratingHistoryApi.getPlayerHistory(orgId, leagueId, playerId, seasonId),
        apiClientV3.leaderboardApi.getLeaderboard(orgId, leagueId, seasonId),
        apiClientV3.seasonsApi.listSeasons(orgId, leagueId),
        apiClientV3.matchFlagsApi.getMyFlags(orgId, leagueId).catch(() => []),
      ]);

    const matches = allMatches.filter((match) =>
      match.teams.some((team) =>
        team.players.some((playerEntry) => playerEntry.leaguePlayerId === playerId)
      )
    );

    const playerEntry = leaderboard.entries?.find(
      (entry) => entry.leaguePlayerId === playerId
    );

    const totalMatches = matches.length;
    const wins = matches.filter((match) =>
      match.teams.some(
        (team) =>
          team.isWinner &&
          team.players.some((playerEntry) => playerEntry.leaguePlayerId === playerId)
      )
    ).length;
    const losses = Math.max(totalMatches - wins, 0);
    const winrate = totalMatches > 0 ? wins / totalMatches : 0;
    const mmr = playerEntry?.mmr ?? player.mmr ?? null;

    return {
      player,
      matches,
      ratingHistory,
      isCurrentUser: playerId === leaguePlayerId,
      stats: {
        mmr,
        totalMatches,
        wins,
        losses,
        winrate,
      },
      orgSlug,
      leagueSlug,
      seasons,
      currentSeason: seasons[0] ?? null,
      myFlags,
    };
  } catch {
    throw error(404, 'Player not found');
  }
};

export const actions: Actions = {
  ...matchFlagActions,
};
