import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { NavbarNav } from './navbar-nav';
import type { QueueStatusResponse } from '@/api-v3';
import { useHydrated } from '@/hooks/use-hydrated';

interface MatchmakingButtonProps {
  path: string;
  orgId: string;
  leagueId: string;
}

export const queueQueryKey = (orgId: string, leagueId: string) =>
  ['queue', orgId, leagueId] as const;

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

  const hydrated = useHydrated();

  // The matchmaking page seeds this shared cache entry, so during SSR whether
  // the count exists depends on render order. Like the reference, show it only
  // after hydration.
  const count = hydrated ? (data?.queuedPlayers?.length ?? 0) : 0;
  const badge = count > 0 ? count : undefined;

  return (
    <NavbarNav path={path} badge={badge}>
      <Play />
    </NavbarNav>
  );
}
