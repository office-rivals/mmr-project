import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { AppLink } from '@/components/app-link';
import { useHydrated } from '@/hooks/use-hydrated';
import { formatStake, matchOdds } from '@/lib/match-prediction';
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
 * Queue, match-found and live-match state for the current league: a bar above
 * the bottom navigation on phones and a card in the sidebar from `lg` up.
 * The queue state is client-only, so nothing renders until hydration.
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
  if (!hydrated || !leaguePlayerId || !data || onPlayPage) return null;

  // From sm the bar keeps to the content column instead of the viewport. z-30
  // keeps it above page overlays such as the random-teams panel.
  const shell = cn(
    'fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] z-30 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-card p-2.5 pl-3 shadow-lg sm:inset-x-0 sm:mx-auto sm:max-w-[39rem]',
    'lg:static lg:inset-auto lg:mx-0 lg:max-w-none lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-3 lg:p-3 lg:shadow-none',
    className
  );
  const textLink =
    'flex min-w-0 flex-1 basis-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:basis-auto';
  const cta =
    'inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary-fill px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-fill/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60';
  const errorText = error ? (
    <p role="alert" className="w-full text-xs text-red-400">
      {error}
    </p>
  ) : null;

  if (data.activeMatch) {
    const started = new Date(data.activeMatch.startedAt).getTime();
    const minutes = Math.max(0, Math.floor((now - started) / 60_000));
    const odds = matchOdds(data.activeMatch.prediction, leaguePlayerId);
    const myTeam = data.activeMatch.teams.find((t) =>
      t.players.some((p) => p.leaguePlayerId === leaguePlayerId)
    );
    const ours = odds?.teams.find((t) => t.index === myTeam?.index);
    const theirs = odds?.teams.find((t) => t !== ours);
    return (
      <section
        aria-label="Live match"
        className={cn(shell, 'overflow-hidden border-green-500/40 lg:relative')}
      >
        <AppLink
          to={`${base}/active-match/${data.activeMatch.id}`}
          className={cn(textLink, 'grid gap-0.5')}
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-green-400 uppercase">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-green-400 motion-safe:animate-pulse"
            />
            Live · {minutes} min
          </span>
          <span className="truncate text-sm font-semibold">
            {teamsLine(data.activeMatch.teams, leaguePlayerId)}
          </span>
          {ours && theirs ? (
            // One line in the phone bar; the narrow sidebar card gives the
            // stake a line of its own rather than cutting it off.
            <span
              data-testid="live-win-chance"
              className="truncate text-[11px] text-muted-foreground tabular-nums lg:whitespace-normal"
            >
              <span className="font-semibold text-primary">
                {ours.winPercent}% win chance
              </span>
              <span className="sr-only">
                {` for your team, ${theirs.winPercent}% for the opponents`}
              </span>
              {odds?.stake ? (
                <>
                  <span className="lg:hidden"> · </span>
                  <span className="lg:block">{formatStake(odds.stake)}</span>
                </>
              ) : null}
            </span>
          ) : null}
        </AppLink>
        <AppLink
          to={`${base}/active-match/${data.activeMatch.id}`}
          className={cta}
        >
          Report result
        </AppLink>
        {ours ? (
          // The odds bar runs along the card's bottom edge so the phone bar
          // stays within the space the page leaves for it.
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 flex h-0.5 bg-muted"
          >
            <span
              className="bg-primary"
              style={{ width: `${ours.winPercent}%` }}
            />
          </span>
        ) : null}
      </section>
    );
  }

  if (data.pendingMatch) {
    return (
      <section
        aria-label="Match found"
        className={cn(shell, 'border-primary/50')}
      >
        <span className="flex min-w-0 flex-1 basis-0 flex-col gap-0.5 lg:basis-auto">
          <span className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
            Match found
          </span>
          <span className="truncate text-sm text-muted-foreground">
            Accept before it expires
          </span>
        </span>
        <AppLink to={`${base}/matchmaking`} className={cta}>
          Respond
        </AppLink>
      </section>
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
      <section aria-label="Your queue" className={shell}>
        <AppLink to={`${base}/matchmaking`} className={textLink}>
          <QueueRing count={queued.length} needed={needed} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">
              In queue · {formatElapsed(seconds)}
            </span>
            <span className="truncate text-xs text-muted-foreground">
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
      </section>
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
      <section aria-label="Queue" className={shell}>
        <AppLink to={`${base}/matchmaking`} className={textLink}>
          <span aria-hidden="true" className="flex shrink-0 -space-x-2">
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
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-primary motion-safe:animate-pulse"
              />
              {queued.length} in queue
            </span>
            <span className="truncate text-xs text-muted-foreground">
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
      </section>
    );
  }

  return null;
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
    <span aria-hidden="true" className="relative flex size-10 shrink-0">
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
