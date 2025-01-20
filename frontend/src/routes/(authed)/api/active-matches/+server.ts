import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { apiClient } }) => {
  const activeMatches =
    await apiClient.matchmakingApi.matchMakingGetActiveMatches();

  return new Response(
    JSON.stringify({
      activeMatches,
    })
  );
};
