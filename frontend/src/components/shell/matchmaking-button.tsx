import { Play } from 'lucide-react';
import { NavbarNav } from './navbar-nav';
import { useQueueStatus } from './use-queue-status';
import { useHydrated } from '@/hooks/use-hydrated';

export { queueQueryKey } from './use-queue-status';

interface MatchmakingButtonProps {
  path: string;
  orgId: string;
  leagueId: string;
}

export function MatchmakingButton({
  path,
  orgId,
  leagueId,
}: MatchmakingButtonProps) {
  const { data } = useQueueStatus(orgId, leagueId);
  const hydrated = useHydrated();

  // The matchmaking page seeds this shared cache entry, so during SSR whether
  // the count exists depends on render order. Like the reference, show it only
  // after hydration.
  const count = hydrated ? (data?.queuedPlayers?.length ?? 0) : 0;

  return (
    <NavbarNav
      path={path}
      icon={Play}
      label="Matchmaking"
      shortLabel="Play"
      badge={count}
      badgeLabel={`${count} in queue`}
    />
  );
}
