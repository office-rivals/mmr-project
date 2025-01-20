import type { RequestHandler } from '../$types';

export const GET: RequestHandler = async ({ locals: { apiClient } }) => {
  const status =
    await apiClient.matchmakingApi.matchMakingGetMatchMakingQueueStatus();

  return new Response(JSON.stringify(status));
};
