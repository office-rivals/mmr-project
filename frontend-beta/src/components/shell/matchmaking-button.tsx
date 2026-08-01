import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { NavbarNav } from './navbar-nav';
import type { QueueStatusResponse } from '@/api-v3';

interface MatchmakingButtonProps {
  path: string;
  orgId: string;
  leagueId: string;
}

export const queueQueryKey = (orgId: string, leagueId: string) =>
  ['queue', orgId, leagueId] as const;

/**
 * Navbar queue badge.
 *
 * In the Svelte app this poll is dead code: it fetches `/api/v3/.../queue` from
 * the browser, `handleFetch` only rewrites *server* fetches, and no proxy route
 * for that URL exists — so every poll 404s and the badge never appears. This
 * app ships the proxy route (`routes/api/v3/organizations/$orgId/leagues/
 * $leagueId/queue.ts`), which is a deliberate improvement. The client-side
 * rules are unchanged: 10s cadence with an immediate fetch on mount, `0 queued`
 * shows no badge at all, and an error leaves the previous value in place
 * (TanStack Query keeps the last successful `data` on a failed refetch).
 */
export function MatchmakingButton({
  path,
  orgId,
  leagueId,
}: MatchmakingButtonProps) {
  const { data } = useQuery({
    queryKey: queueQueryKey(orgId, leagueId),
    queryFn: async (): Promise<QueueStatusResponse> => {
      const res = await fetch(
        `/api/v3/organizations/${orgId}/leagues/${leagueId}/queue`
      );
      if (!res.ok) throw new Error(`Queue request failed: ${res.status}`);
      return res.json() as Promise<QueueStatusResponse>;
    },
    refetchInterval: 10_000,
    staleTime: 0,
    retry: false,
  });

  const count = data?.queuedPlayers?.length ?? 0;
  const badge = count > 0 ? count : undefined;

  return (
    <NavbarNav path={path} badge={badge}>
      <Play />
    </NavbarNav>
  );
}
