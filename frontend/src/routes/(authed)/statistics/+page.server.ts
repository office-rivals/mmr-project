import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClient }, url }) => {
  try {
    const searchParams = url.searchParams;
    const seasonId = searchParams.get('season')
      ? Number(searchParams.get('season'))
      : undefined;

    const [statistics, timeDistribution, seasons] = await Promise.all([
      apiClient.statisticsApi
        .statisticsGetPlayerHistory({ seasonId })
        .then((res) => res.toSorted((a, b) => a.name.localeCompare(b.name))),
      apiClient.statisticsApi.statisticsGetTimeDistribution({ seasonId }),
      apiClient.seasonsApi.seasonsGetSeasons(),
    ]);

    return {
      statistics,
      timeDistribution,
      seasons,
      currentSeason: seasons[0],
    };
  } catch (error) {
    fail(500, {
      message: 'Failed to load statistics',
    });
  }
};
