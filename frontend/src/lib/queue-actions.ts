import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import { queueQueryKey } from '@/components/shell/use-queue-status';
import { failServerAction } from '@/lib/server/action-result';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type { QueryClient } from '@tanstack/react-query';
import type { QueueStatusResponse } from '@/api-v3';

export type QueueActionResult =
  { status: 'error'; message: string } | { status: 'ok' };

export type QueueActionName = 'join' | 'leave' | 'accept' | 'decline';

export interface QueueActionInput {
  orgId: string;
  leagueId: string;
  action: QueueActionName;
  matchId?: string;
}

export const TRANSPORT_FALLBACKS: Record<QueueActionName, string> = {
  join: 'Failed to join queue',
  leave: 'Failed to leave queue',
  accept: 'Failed to accept match',
  decline: 'Failed to decline match',
};

// Shared by the RPC above and the no-JS form POST on the matchmaking route.
export const queueAction = createServerOnlyFn(async function queueAction(
  data: QueueActionInput
): Promise<QueueActionResult> {
  const needsMatchId = data.action === 'accept' || data.action === 'decline';
  if (needsMatchId && !data.matchId) {
    return failServerAction(400, {
      status: 'error',
      message: 'Match ID is required',
    });
  }
  if (!data.orgId || !data.leagueId) {
    return failServerAction(400, {
      status: 'error',
      message: 'Organization and league are required',
    });
  }

  const apiClientV3 = await requireApiClientV3();
  try {
    switch (data.action) {
      case 'join':
        await apiClientV3.queueApi.joinQueue(data.orgId, data.leagueId);
        break;
      case 'leave':
        await apiClientV3.queueApi.leaveQueue(data.orgId, data.leagueId);
        break;
      case 'accept':
        await apiClientV3.pendingMatchesApi.acceptPendingMatch(
          data.orgId,
          data.leagueId,
          data.matchId!
        );
        break;
      case 'decline':
        await apiClientV3.pendingMatchesApi.declinePendingMatch(
          data.orgId,
          data.leagueId,
          data.matchId!
        );
        break;
    }
  } catch (error) {
    const { status, message } = await getApiErrorDetails(
      error,
      TRANSPORT_FALLBACKS[data.action]
    );
    return failServerAction(status, { status: 'error', message });
  }

  return { status: 'ok' };
});

export const queueActionFn = createServerFn({ method: 'POST' })
  .validator((input: QueueActionInput) => input)
  .handler(({ data }): Promise<QueueActionResult> => queueAction(data));

const getQueueStatusFn = createServerFn({ method: 'GET' })
  .validator((input: { orgId: string; leagueId: string }) => input)
  .handler(async ({ data }): Promise<QueueStatusResponse> => {
    const apiClientV3 = await requireApiClientV3();
    return apiClientV3.queueApi.getQueueStatus(data.orgId, data.leagueId);
  });

/**
 * Seeds the shared queue query from a loader, so queue-driven UI renders on
 * the server instead of appearing after hydration. Best effort.
 */
export async function prefetchQueueStatus(
  queryClient: QueryClient,
  orgId: string,
  leagueId: string
): Promise<void> {
  await queryClient
    .ensureQueryData({
      queryKey: queueQueryKey(orgId, leagueId),
      queryFn: () => getQueueStatusFn({ data: { orgId, leagueId } }),
    })
    .catch(() => undefined);
}
