import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
  await parent();

  const apiClient = locals.apiClient;
  const seasons = await apiClient.seasonsApi.seasonsGetSeasons();

  return {
    currentSeason: seasons[0] || null,
  };
};
