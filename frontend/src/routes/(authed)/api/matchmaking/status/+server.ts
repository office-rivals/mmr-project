import type { RequestHandler } from './$types';
import type { TweakedMatchMakingQueueStatus } from './types';

export const GET: RequestHandler = async ({ locals: { apiClient } }) => {
  const { assignedActiveMatch, ...rest } =
    await apiClient.matchmakingApi.matchMakingGetMatchMakingQueueStatus();

  const status: TweakedMatchMakingQueueStatus = { ...rest };
  if (assignedActiveMatch != null) {
    const playerIds = [
      ...assignedActiveMatch.team1.playerIds,
      ...assignedActiveMatch.team2.playerIds,
    ];
    const users = await apiClient.usersApi.usersGetUsers();
    const filteredUsers = users.filter((user) =>
      playerIds.includes(user.userId)
    );
    const activeMatchWithUsers = {
      ...assignedActiveMatch,
      users: filteredUsers,
    };
    status.assignedActiveMatch = activeMatchWithUsers;
  }

  return new Response(JSON.stringify(status));
};
