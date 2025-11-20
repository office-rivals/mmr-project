import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
  await parent();

  const apiClient = locals.apiClient;
  const seasons = await apiClient.seasonsApi.seasonsGetSeasons();
  const pendingFlags = await apiClient.adminMatchFlagsApi.adminMatchFlagsGetPendingFlags();

  return {
    currentSeason: seasons[0] || null,
    pendingFlagsCount: pendingFlags.length,
  };
};
