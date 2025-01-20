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

export const POST: RequestHandler = async ({
  request,
  locals: { apiClient },
}) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (!intent) {
    return new Response('No intent provided', { status: 400 });
  }

  const matchId = formData.get('matchId')?.toString();

  if (!matchId) {
    return new Response('No matchId provided', { status: 400 });
  }

  switch (intent) {
    case 'cancel':
      await apiClient.matchmakingApi.matchMakingCancelActiveMatch({ matchId });
      return new Response('Cancelled match');
    default:
      return new Response('Unknown intent', { status: 400 });
  }
};
