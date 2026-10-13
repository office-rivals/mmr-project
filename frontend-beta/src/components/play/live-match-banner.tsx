import { AppLink } from '@/components/app-link';
import { useQueueStatus } from '@/components/shell/use-queue-status';
import { useHydrated } from '@/hooks/use-hydrated';
import { getPlayerDisplayName } from '@/lib/utils';
import type { PendingMatchTeamResponse } from '@/api-v3';

interface LiveMatchBannerProps {
  base: string;
  orgId: string;
  leagueId: string;
  leaguePlayerId: string | null;
}

/** Offers the viewer's live matchmaking match before the manual form. */
export function LiveMatchBanner({
  base,
  orgId,
  leagueId,
  leaguePlayerId,
}: LiveMatchBannerProps) {
  const hydrated = useHydrated();
  const { data } = useQueueStatus(orgId, leagueId);
  const match = data?.activeMatch;
  if (!hydrated || !match || !leaguePlayerId) return null;

  const isMine = (team: PendingMatchTeamResponse) =>
    team.players.some((p) => p.leaguePlayerId === leaguePlayerId);
  const mine = match.teams.find(isMine);
  const theirs = match.teams.find((t) => !isMine(t));
  const names = (team: PendingMatchTeamResponse | undefined) =>
    (team?.players ?? [])
      .map((p) =>
        p.leaguePlayerId === leaguePlayerId ? 'You' : getPlayerDisplayName(p)
      )
      .join(' + ');

  return (
    <section
      aria-label="Your live match"
      className="flex flex-col gap-3 rounded-lg border border-primary/50 bg-gradient-to-br from-primary/15 to-primary/5 p-4"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold tracking-[0.14em] uppercase">
        <span className="flex items-center gap-1.5 text-green-400">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-green-400 motion-safe:animate-pulse"
          />
          Your live match
        </span>
        <span className="font-medium tracking-normal text-muted-foreground normal-case">
          From matchmaking
        </span>
      </div>
      <p className="truncate font-bold">
        {names(mine)}{' '}
        <span className="px-1 text-xs font-normal text-muted-foreground">
          vs
        </span>{' '}
        {names(theirs)}
      </p>
      <AppLink
        to={`${base}/active-match/${match.id}`}
        className="flex h-11 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        Report this match
      </AppLink>
      <p className="flex items-center gap-3 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        Or a different match
        <span className="h-px flex-1 bg-border" />
      </p>
    </section>
  );
}
