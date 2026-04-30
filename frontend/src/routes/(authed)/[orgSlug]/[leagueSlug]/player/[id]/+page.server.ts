import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { matchFlagActions } from '$lib/server/actions/matchFlagActions';
import type { MatchResponse } from '$api3/models';
import { movePlayerToTopLeft } from './utils';

interface OpponentEntry {
  leaguePlayerId: string;
  displayName?: string;
  username?: string;
  wins: number;
  losses: number;
  total: number;
}

export const load: PageServerLoad = async ({
  params,
  parent,
  locals: { apiClientV3 },
  url,
}) => {
  const { orgId, leagueId, leaguePlayerId, orgSlug, leagueSlug } =
    await parent();
  const playerId = params.id;
  const urlSeasonId = url.searchParams.get('season') ?? undefined;

  try {
    const seasonsList = await apiClientV3.seasonsApi.listSeasons(
      orgId,
      leagueId
    );
    const currentSeason = seasonsList[0] ?? null;
    const seasonId = urlSeasonId ?? currentSeason?.id;

    const [
      player,
      matches,
      ratingHistory,
      leaderboard,
      seasons,
      players,
      myFlags,
    ] = await Promise.all([
      apiClientV3.leaguePlayersApi.getPlayer(orgId, leagueId, playerId),
      apiClientV3.matchesApi.getMatches(orgId, leagueId, {
        seasonId,
        leaguePlayerId: playerId,
        limit: 1000,
        offset: 0,
      }),
      apiClientV3.ratingHistoryApi.getPlayerHistory(
        orgId,
        leagueId,
        playerId,
        seasonId
      ),
      apiClientV3.leaderboardApi.getLeaderboard(orgId, leagueId, seasonId),
      Promise.resolve(seasonsList),
      apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
      apiClientV3.matchFlagsApi.getMyFlags(orgId, leagueId).catch(() => []),
    ]);

    const playerEntry = leaderboard.entries?.find(
      (entry) => entry.leaguePlayerId === playerId
    );

    const totalMatches = matches.length;
    const wins = matches.filter((m: MatchResponse) =>
      m.teams.some(
        (t) =>
          t.isWinner && t.players.some((p) => p.leaguePlayerId === playerId)
      )
    ).length;
    const lost = Math.max(totalMatches - wins, 0);
    const winrate = totalMatches > 0 ? wins / totalMatches : 0;
    const mmr = playerEntry?.mmr ?? null;

    const lastMatchAt = matches[0]?.playedAt;
    const daysSinceLastMatch = lastMatchAt
      ? Math.round(
          (new Date(lastMatchAt).getTime() - Date.now()) / 1000 / 60 / 60 / 24
        )
      : null;

    const teammateAcc: Record<string, OpponentEntry> = {};
    const opponentAcc: Record<string, OpponentEntry> = {};

    for (const match of matches) {
      const myTeam = match.teams.find((t) =>
        t.players.some((p) => p.leaguePlayerId === playerId)
      );
      const otherTeam = match.teams.find((t) => t !== myTeam);
      if (!myTeam || !otherTeam) continue;
      const isWin = !!myTeam.isWinner;

      for (const teammate of myTeam.players) {
        if (teammate.leaguePlayerId === playerId) continue;
        const acc = (teammateAcc[teammate.leaguePlayerId] ??= {
          leaguePlayerId: teammate.leaguePlayerId,
          displayName: teammate.displayName,
          username: teammate.username,
          wins: 0,
          losses: 0,
          total: 0,
        });
        acc.wins += isWin ? 1 : 0;
        acc.losses += isWin ? 0 : 1;
        acc.total += 1;
      }
      for (const opp of otherTeam.players) {
        const acc = (opponentAcc[opp.leaguePlayerId] ??= {
          leaguePlayerId: opp.leaguePlayerId,
          displayName: opp.displayName,
          username: opp.username,
          wins: 0,
          losses: 0,
          total: 0,
        });
        acc.wins += isWin ? 1 : 0;
        acc.losses += isWin ? 0 : 1;
        acc.total += 1;
      }
    }

    const teammates = Object.values(teammateAcc)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const opponents = Object.values(opponentAcc)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const reorderedMatches = matches.map((m: MatchResponse) =>
      movePlayerToTopLeft(m, playerId)
    );

    return {
      player,
      matches: reorderedMatches,
      ratingHistory,
      isCurrentUser: playerId === leaguePlayerId,
      stats: {
        mmr,
        totalMatches,
        wins,
        lost,
        winrate,
        daysSinceLastMatch,
        winningStreak: playerEntry?.winningStreak ?? 0,
        losingStreak: playerEntry?.losingStreak ?? 0,
      },
      teammates,
      opponents,
      players,
      orgSlug,
      leagueSlug,
      seasons,
      currentSeason,
      isCurrentSeason: urlSeasonId == null || urlSeasonId === currentSeason?.id,
      myFlags,
    };
  } catch {
    throw error(404, 'Player not found');
  }
};

export const actions: Actions = {
  ...matchFlagActions,
};
