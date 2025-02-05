import type { TweakedMatchMakingQueueStatus } from '../../../routes/(authed)/api/matchmaking/status/types';

// TODO: Share this across components
const getQueueStatus = async () => {
  const response = await fetch('/api/matchmaking/status');
  return (await response.json()) as TweakedMatchMakingQueueStatus;
};

const createRefreshQueueStatus =
  (callback: (status: TweakedMatchMakingQueueStatus) => void | Promise<void>) =>
  async () => {
    const status = await getQueueStatus();
    await Promise.resolve(callback(status));
  };

export { createRefreshQueueStatus };
