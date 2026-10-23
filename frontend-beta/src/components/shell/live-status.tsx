import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { AppLink } from '@/components/app-link';
import { useHydrated } from '@/hooks/use-hydrated';
import { queueActionFn, type QueueActionName } from '@/lib/queue-actions';
import { cn, formatElapsed, getPlayerDisplayName, initials } from '@/lib/utils';
import { queueQueryKey, useQueueStatus } from './use-queue-status';
import type { PendingMatchTeamResponse } from '@/api-v3';

interface LiveStatusProps {
  base: string;
  orgId: string;
  leagueId: string;
  leaguePlayerId: string | null;
  teamSize: number | null;
  className?: string;
}

/**
 * Queue, match-found and live-match state for the current league: a strip on
 * top of the bottom navigation on phones and a card in the sidebar from `lg`
 * up. The queue state is client-only, so nothing renders until hydration.
 */
export function LiveStatus({
  base,
  orgId,
  leagueId,
  leaguePlayerId,
  teamSize,
  className,
}: LiveStatusProps) {
  const hydrated = useHydrated();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useQueueStatus(orgId, leagueId);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const action = useMutation({
    mutationFn: (name: QueueActionName) =>
      queueActionFn({ data: { action: name, orgId, leagueId } }),
    onSuccess: (result) =>
      setError(result.status === 'error' ? result.message : null),
    onError: () => setError('Could not update the queue'),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queueQueryKey(orgId, leagueId),
      }),
  });

  const queued = data?.queuedPlayers ?? [];
  const myEntry = queued.find((p) => p.leaguePlayerId === leaguePlayerId);
  const now = useNow(myEntry != null || data?.activeMatch != null);

  // The play pages already show this state in full; Submit has its own
  // live-match banner.
  const onPlayPage =
    pathname.startsWith(`${base}/matchmaking`) ||
    pathname.startsWith(`${base}/active-match`) ||
    pathname.startsWith(`${base}/submit`);
  // Teams needs the room for fingers; Play still carries the queue count.
  const onTeamsPage = pathname === '/random';
  if (!hydrated || !leaguePlayerId || !data || onPlayPage || onTeamsPage) {
    return null;
  }

  const shell = (tone?: string) =>
    cn(
      // Sits on the bottom bar's 1px top border, not over it.
      'fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+var(--dock-height)+1px)] z-30 border-t bg-card',
      'lg:static lg:flex lg:flex-col lg:gap-3 lg:rounded-lg lg:border lg:p-3',
      tone,
      className
    );
  const textLink =
    'col-start-1 flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  // A 32px button on phones, with its hit area stretched to the strip's 44px.
  const cta =
    'relative col-start-3 inline-flex h-8 min-w-20 shrink-0 items-center justify-center justify-self-end rounded-md bg-primary-fill px-4 text-sm font-bold text-primary-foreground transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 hover:bg-primary-fill/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60 lg:h-10 lg:min-w-0 lg:after:hidden';
  const errorText = error ? (
    <p role="alert" className="col-span-3 pb-2 text-xs text-red-400 lg:pb-0">
      {error}
    </p>
  ) : null;

  if (data.activeMatch) {
    const started = new Date(data.activeMatch.startedAt).getTime();
    const minutes = Math.max(0, Math.floor((now - started) / 60_000));
    return (
      <StatusShell label="Live match" className={shell('border-green-500/40')}>
        <AppLink
          to={`${base}/active-match/${data.activeMatch.id}`}
          className={cn(textLink, 'grid gap-0.5')}
        >
          <span className="flex items-center gap-1.5 text-[10px] leading-3 font-bold tracking-[0.14em] text-green-400 uppercase lg:leading-normal">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-green-400 motion-safe:animate-pulse"
            />
            Live · {minutes} min
          </span>
          <span className="truncate text-sm leading-4 font-semibold lg:leading-5">
            {teamsLine(data.activeMatch.teams, leaguePlayerId)}
          </span>
        </AppLink>
        <AppLink
          to={`${base}/active-match/${data.activeMatch.id}`}
          aria-label="Report result"
          className={cta}
        >
          <span className="lg:hidden">Report</span>
          <span className="hidden lg:inline">Report result</span>
        </AppLink>
      </StatusShell>
    );
  }

  if (data.pendingMatch) {
    return (
      <StatusShell label="Match found" className={shell('border-primary/50')}>
        <span className="col-start-1 flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] leading-3 font-bold tracking-[0.14em] text-primary uppercase lg:leading-normal">
            Match found
          </span>
          <span className="truncate text-sm leading-4 text-muted-foreground lg:leading-5">
            Accept before it expires
          </span>
        </span>
        <AppLink to={`${base}/matchmaking`} className={cta}>
          Respond
        </AppLink>
      </StatusShell>
    );
  }

  const needed = teamSize ? teamSize * 2 : null;

  if (myEntry) {
    const seconds = Math.max(
      0,
      Math.floor((now - new Date(myEntry.joinedAt).getTime()) / 1000)
    );
    const missing = needed ? Math.max(0, needed - queued.length) : null;
    return (
      <StatusShell label="Your queue" className={shell()}>
        <AppLink to={`${base}/matchmaking`} className={textLink}>
          <QueueRing count={queued.length} needed={needed} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm leading-4 font-semibold lg:leading-5">
              In queue · {formatElapsed(seconds)}
            </span>
            <span className="truncate text-xs leading-3.5 text-muted-foreground lg:leading-4">
              {missing
                ? `${missing} more ${missing === 1 ? 'player' : 'players'} needed`
                : 'Finding your match'}
            </span>
          </span>
        </AppLink>
        <button
          type="button"
          className={cn(
            cta,
            'bg-transparent text-foreground ring-1 ring-border hover:bg-muted'
          )}
          disabled={action.isPending}
          onClick={() => action.mutate('leave')}
        >
          Leave
        </button>
        {errorText}
      </StatusShell>
    );
  }

  if (queued.length > 0) {
    const names = queued.slice(0, 2).map((p) => getPlayerDisplayName(p));
    const others = queued.length - names.length;
    const who =
      others > 0
        ? `${names.join(', ')} and ${others} more`
        : names.join(' and ');
    return (
      <StatusShell label="Queue" className={shell()}>
        <AppLink to={`${base}/matchmaking`} className={textLink}>
          <span
            aria-hidden="true"
            className="hidden shrink-0 -space-x-2 lg:flex"
          >
            {queued.slice(0, 2).map((p) => (
              <span
                key={p.leaguePlayerId}
                className="flex size-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold"
              >
                {initials(getPlayerDisplayName(p))}
              </span>
            ))}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-sm leading-4 font-semibold lg:leading-5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-primary motion-safe:animate-pulse"
              />
              {queued.length} in queue
            </span>
            <span className="truncate text-xs leading-3.5 text-muted-foreground lg:leading-4">
              {who} {queued.length === 1 ? 'wants' : 'want'} a game
            </span>
          </span>
        </AppLink>
        <button
          type="button"
          className={cta}
          disabled={action.isPending}
          onClick={() => action.mutate('join')}
        >
          Join
        </button>
        {errorText}
      </StatusShell>
    );
  }

  return null;
}

/**
 * On phones Submit's tile rises into the strip's centre, so the text keeps to
 * the left of it and the action to the right. From `lg` the card stacks them.
 */
function StatusShell({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} data-live-strip="" className={className}>
      <div className="mx-auto grid min-h-11 w-full max-w-screen-sm grid-cols-[1fr_4.75rem_1fr] items-center px-3 lg:contents">
        {children}
      </div>
    </section>
  );
}

function QueueRing({
  count,
  needed,
}: {
  count: number;
  needed: number | null;
}) {
  const circumference = 2 * Math.PI * 16;
  const filled = needed ? Math.min(1, count / needed) : 0;
  return (
    <span
      aria-hidden="true"
      className="relative hidden size-10 shrink-0 lg:flex"
    >
      <svg viewBox="0 0 40 40" className="size-10 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          strokeWidth="4"
          className="stroke-muted"
        />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled * circumference} ${circumference}`}
          className="stroke-primary"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
        {needed ? `${count}/${needed}` : count}
      </span>
    </span>
  );
}

function teamsLine(
  teams: PendingMatchTeamResponse[],
  leaguePlayerId: string
): string {
  const mine = (t: PendingMatchTeamResponse) =>
    t.players.some((p) => p.leaguePlayerId === leaguePlayerId);
  const ordered = [...teams].sort((a, b) => Number(mine(b)) - Number(mine(a)));
  return ordered
    .map((team) =>
      team.players
        .map((p) =>
          p.leaguePlayerId === leaguePlayerId ? 'You' : getPlayerDisplayName(p)
        )
        .join(' + ')
    )
    .join(' vs ');
}

function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);
  return now;
}
