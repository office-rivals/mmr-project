import type { RequestHandler } from '../$types';

export const POST: RequestHandler = async ({
  request,
  locals: { apiClient },
}) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (!intent) {
    return new Response('No intent provided', { status: 400 });
  }

  switch (intent) {
    case 'leave':
      await apiClient.matchmakingApi.matchMakingLeaveMatchMakingQueue();
      return new Response('Left matchmaking queue');
    case 'accept': {
      const matchId = formData.get('matchId')?.toString();
      if (!matchId) {
        return new Response('No matchId provided', { status: 400 });
      }
      await apiClient.matchmakingApi.matchMakingAcceptMatch({ matchId });
      return new Response('Accepted match');
    }
    case 'reject': {
      const matchId = formData.get('matchId')?.toString();
      if (!matchId) {
        return new Response('No matchId provided', { status: 400 });
      }
      await apiClient.matchmakingApi.matchMakingRejectMatch({ matchId });
      return new Response('Rejected match');
    }
    default:
      return new Response('Unknown intent', { status: 400 });
  }
};
