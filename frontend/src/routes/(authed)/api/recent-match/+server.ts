import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { apiClient } }) => {
  const playerId = Number(url.searchParams.get('playerId'));
  if (Number.isNaN(playerId)) {
    throw new Error('Invalid player ID');
  }
  const latestMatch = await apiClient.mmrApi.mMRV2GetMatches({
    userId: playerId,
    limit: 1,
    offset: 0,
  });

  return new Response(
    JSON.stringify({
      playerId,
      latestMatch: latestMatch[0],
    })
  );
};
