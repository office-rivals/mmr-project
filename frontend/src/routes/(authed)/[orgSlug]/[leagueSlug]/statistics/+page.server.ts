import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { apiClientV3 }, url }) => {
  const { orgId, leagueId } = await parent();
  const urlSeasonId = url.searchParams.get('season') ?? undefined;
  const seasons = await apiClientV3.seasonsApi.listSeasons(orgId, leagueId);
  const currentSeason = seasons[0] ?? null;
  const seasonId = urlSeasonId ?? currentSeason?.id;

  try {
    const [leaderboard, timeDistribution] = await Promise.all([
      apiClientV3.leaderboardApi.getLeaderboard(orgId, leagueId, seasonId),
      apiClientV3.statisticsApi
        .getTimeDistribution(orgId, leagueId, seasonId)
        .catch(() => ({ entries: [] })),
    ]);

    const playerHistories = await Promise.all(
      (leaderboard.entries ?? []).slice(0, 10).map(async (entry) => {
        try {
          const history = await apiClientV3.ratingHistoryApi.getPlayerHistory(
            orgId,
            leagueId,
            entry.leaguePlayerId,
            seasonId
          );
          return {
            name: entry.displayName ?? entry.username ?? 'Unknown',
            entries: history.entries ?? [],
          };
        } catch {
          return null;
        }
      })
    );

    const statistics = playerHistories
      .filter(Boolean)
      .flatMap((ph) =>
        ph?.entries.map((entry) => ({
          name: ph.name,
          date: entry.recordedAt,
          mmr: entry.mmr,
        })) ?? []
      );

    return {
      statistics,
      seasons: seasons ?? [],
      currentSeason,
      timeDistribution: timeDistribution.entries,
    };
  } catch {
    throw error(500, 'Failed to load statistics');
  }
};
