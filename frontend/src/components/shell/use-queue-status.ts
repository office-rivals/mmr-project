import { useQuery } from '@tanstack/react-query';
import type { QueueStatusResponse } from '@/api-v3';

export const queueQueryKey = (orgId: string, leagueId: string) =>
  ['queue', orgId, leagueId] as const;

export async function fetchQueueStatus(
  orgId: string,
  leagueId: string
): Promise<QueueStatusResponse> {
  const res = await fetch(
    `/api/v3/organizations/${orgId}/leagues/${leagueId}/queue`
  );
  if (!res.ok) throw new Error(`Queue request failed: ${res.status}`);
  return res.json() as Promise<QueueStatusResponse>;
}

/** Shared queue poll; observers with a shorter interval speed it up for all. */
export function useQueueStatus(
  orgId: string,
  leagueId: string,
  options: { refetchInterval?: number; initialData?: QueueStatusResponse } = {}
) {
  return useQuery({
    queryKey: queueQueryKey(orgId, leagueId),
    queryFn: () => fetchQueueStatus(orgId, leagueId),
    initialData: options.initialData,
    refetchInterval: options.refetchInterval ?? 10_000,
    staleTime: 0,
    retry: false,
  });
}
