import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClient } }) => {
  try {
    const statistics = (
      await apiClient.statisticsApi.v1StatsPlayerHistoryGet()
    ).toSorted((a, b) => a.name.localeCompare(b.name));

    return {
      statistics,
    };
  } catch (error) {
    fail(500, {
      message: 'Failed to load statistics',
    });
  }
};
