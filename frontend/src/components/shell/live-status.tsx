import { useEffect, useState, type RefObject } from 'react';
import { Popover } from '@base-ui/react/popover';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { AppLink } from '@/components/app-link';
import { PendingMatchDialog } from '@/components/play/pending-match-dialog';
import { useHydrated } from '@/hooks/use-hydrated';
import { matchOdds, stakeLabel } from '@/lib/match-prediction';
import { queueActionFn, type QueueActionName } from '@/lib/queue-actions';
import { cn, formatElapsed, getPlayerDisplayName, initials } from '@/lib/utils';
import { queueQueryKey, useQueueStatus } from './use-queue-status';
import type {
  ActiveMatchResponse,
  PendingMatchResponse,
  PendingMatchTeamResponse,
  QueuedPlayerResponse,
} from '@/api-v3';

interface LiveStatusProps {
  base: string;
  orgId: string;
  leagueId: string;
  leaguePlayerId: string | null;
  teamSize: number | null;
  className?: string;
}

type LiveState =
  | { kind: 'live'; match: ActiveMatchResponse; minutes: number }
  | { kind: 'pending'; match: PendingMatchResponse; secondsLeft: number }
  | { kind: 'queued'; seconds: number; count: number; needed: number | null }
  | { kind: 'waiting'; players: QueuedPlayerResponse[] };

const LABEL = {
  live: 'Live match',
  queued: 'Your queue',
  waiting: 'Queue',
} as const;

/**
 * Queue and live-match state for the current league, as a card in the sidebar
 * from `lg` up; on phones these collapse into `LiveStatusPill`. A match found
 * expires, so at every width it opens the Play page's dialog instead.
 */
export function LiveStatus(props: LiveStatusProps) {
  const state = useLiveState(props);
  const action = useQueueAction(props.orgId, props.leagueId);
  if (!state) return null;
  if (state.kind === 'pending') {
    const matchId = state.match.id;
    return (
      <PendingMatchDialog
        open
        pendingMatch={state.match}
        myAcceptance={state.match.acceptances.find(
          (a) => a.leaguePlayerId === props.leaguePlayerId
        )}
        secondsRemaining={state.secondsLeft}
        responding={action.isPending}
        leaguePlayerId={props.leaguePlayerId}
        onAccept={() => action.mutate({ action: 'accept', matchId })}
        onDecline={() => action.mutate({ action: 'decline', matchId })}
      />
    );
  }
  return (
    <section
      aria-label={LABEL[state.kind]}
      className={cn(
        'hidden flex-col gap-3 rounded-lg border bg-card p-3 lg:flex',
        state.kind === 'live' && 'border-green-500/40',
        props.className
      )}
    >
      <StatusBody
        state={state}
        base={props.base}
        leaguePlayerId={props.leaguePlayerId!}
        action={action}
        variant="card"
      />
    </section>
  );
}

/**
 * The phone's collapsed live status: a pill in the top bar that opens the full
 * status in a panel under the bar.
 */
export function LiveStatusPill({
  anchor,
  ...props
}: LiveStatusProps & { anchor: RefObject<HTMLElement | null> }) {
  const state = useLiveState(props);
  const [open, setOpen] = useState(false);
  const action = useQueueAction(props.orgId, props.leagueId, () =>
    setOpen(false)
  );
  if (!state || state.kind === 'pending') return null;

  const live = state.kind === 'live';
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={pillName(state)}
        className="group flex h-11 shrink-0 items-center rounded-full focus-visible:outline-none lg:hidden"
      >
        <span
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap tabular-nums transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-data-[popup-open]:bg-muted',
            live ? 'border-green-500/40' : 'border-primary/50'
          )}
        >
          {state.kind === 'waiting' ? (
            <>
              <Dot className="bg-primary" />
              {state.players.length} in queue
            </>
          ) : state.kind === 'queued' ? (
            <>
              <QueueRing count={state.count} needed={state.needed} small />
              {state.needed
                ? `${state.count}/${state.needed}`
                : `${state.count} in queue`}
            </>
          ) : (
            <>
              <Dot className="bg-green-400" />
              {state.minutes} min
            </>
          )}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        {/* Anchored to the whole bar, so the panel spans it edge to edge. */}
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={0}
          collisionPadding={0}
          positionMethod="fixed"
          className="z-30 lg:hidden"
        >
          <Popover.Popup
            aria-label={LABEL[state.kind]}
            className="w-[var(--anchor-width)] border-b bg-card shadow-lg outline-none"
          >
            <div className="mx-auto flex min-h-14 w-full max-w-screen-sm flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
              <StatusBody
                state={state}
                base={props.base}
                leaguePlayerId={props.leaguePlayerId!}
                action={action}
                variant="panel"
                onNavigate={() => setOpen(false)}
              />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const CTA =
  'inline-flex shrink-0 items-center justify-center rounded-md bg-primary-fill px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-fill/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60';

type QueueAction = ReturnType<typeof useQueueAction>;

/** The card's and the panel's contents: the status text, then its action. */
function StatusBody({
  state,
  base,
  leaguePlayerId,
  action,
  variant,
  onNavigate,
}: {
  state: Exclude<LiveState, { kind: 'pending' }>;
  base: string;
  leaguePlayerId: string;
  action: QueueAction;
  variant: 'card' | 'panel';
  onNavigate?: () => void;
}) {
  const textLink = cn(
    'flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    variant === 'panel' && 'flex-1'
  );
  const cta = cn(CTA, variant === 'panel' ? 'h-11 min-w-20' : 'h-10');
  const errorText = action.error ? (
    <p role="alert" className="w-full text-xs text-red-400">
      {action.error}
    </p>
  ) : null;

  if (state.kind === 'live') {
    const href = `${base}/active-match/${state.match.id}`;
    const odds = matchOdds(state.match.prediction, leaguePlayerId);
    const myTeam = state.match.teams.find((t) =>
      t.players.some((p) => p.leaguePlayerId === leaguePlayerId)
    );
    const ours = odds?.teams.find((t) => t.index === myTeam?.index);
    const theirs = odds?.teams.find((t) => t !== ours);
    const stake = odds ? stakeLabel(odds) : null;
    return (
      <>
        <AppLink
          to={href}
          onClick={onNavigate}
          className={cn(textLink, 'grid gap-0.5')}
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-green-400 uppercase">
            <Dot className="size-1.5 bg-green-400" />
            Live · {state.minutes} min
          </span>
          <span className="truncate text-sm font-semibold">
            {teamsLine(state.match.teams, leaguePlayerId)}
          </span>
          {ours && theirs ? (
            <span
              data-testid="live-win-chance"
              className="grid gap-1 text-[11px] text-muted-foreground tabular-nums"
            >
              <span>
                <span className="font-semibold text-primary">
                  {ours.winPercent}% win chance
                </span>
                <span className="sr-only">
                  {` for your team, ${theirs.winPercent}% for the opponents`}
                </span>
                {/* The narrow sidebar card gives the stake its own line rather
                    than breaking it mid-phrase. */}
                {stake ? (
                  variant === 'card' ? (
                    <span className="block">{stake}</span>
                  ) : (
                    ` · ${stake}`
                  )
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className="flex h-1 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className="bg-primary"
                  style={{ width: `${ours.winPercent}%` }}
                />
              </span>
            </span>
          ) : null}
        </AppLink>
        <AppLink to={href} onClick={onNavigate} className={cta}>
          Report result
        </AppLink>
      </>
    );
  }

  if (state.kind === 'queued') {
    const missing = state.needed
      ? Math.max(0, state.needed - state.count)
      : null;
    return (
      <>
        <AppLink
          to={`${base}/matchmaking`}
          onClick={onNavigate}
          className={textLink}
        >
          <QueueRing count={state.count} needed={state.needed} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">
              In queue for {formatElapsed(state.seconds)}
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
          onClick={() => action.mutate({ action: 'leave' })}
        >
          Leave
        </button>
        {errorText}
      </>
    );
  }

  const queued = state.players;
  const names = queued.slice(0, 2).map((p) => getPlayerDisplayName(p));
  const others = queued.length - names.length;
  const who =
    others > 0 ? `${names.join(', ')} and ${others} more` : names.join(' and ');
  return (
    <>
      <AppLink
        to={`${base}/matchmaking`}
        onClick={onNavigate}
        className={textLink}
      >
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
            <Dot className="bg-primary" />
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
        onClick={() => action.mutate({ action: 'join' })}
      >
        Join
      </button>
      {errorText}
    </>
  );
}

/**
 * The live state both views show. Null while hydrating, on the play pages
 * (they show it in full; Submit has its own live-match banner) and on Teams.
 */
function useLiveState({
  base,
  orgId,
  leagueId,
  leaguePlayerId,
  teamSize,
}: LiveStatusProps): LiveState | null {
  const hydrated = useHydrated();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useQueueStatus(orgId, leagueId);
  const queued = data?.queuedPlayers ?? [];
  const myEntry = queued.find((p) => p.leaguePlayerId === leaguePlayerId);
  const now = useNow(
    myEntry != null || data?.activeMatch != null || data?.pendingMatch != null
  );

  const onPlayPage =
    pathname.startsWith(`${base}/matchmaking`) ||
    pathname.startsWith(`${base}/active-match`) ||
    pathname.startsWith(`${base}/submit`);
  // Teams needs the room for fingers; Play still carries the queue count.
  const onTeamsPage = pathname === '/random';
  if (!hydrated || !leaguePlayerId || !data || onPlayPage || onTeamsPage) {
    return null;
  }

  const secondsSince = (iso: string) =>
    Math.floor((now - new Date(iso).getTime()) / 1000);
  if (data.activeMatch) {
    const minutes = Math.floor(secondsSince(data.activeMatch.startedAt) / 60);
    return {
      kind: 'live',
      match: data.activeMatch,
      minutes: Math.max(0, minutes),
    };
  }
  if (data.pendingMatch) {
    const left = -secondsSince(data.pendingMatch.expiresAt);
    return {
      kind: 'pending',
      match: data.pendingMatch,
      secondsLeft: Math.max(0, left),
    };
  }
  if (myEntry) {
    return {
      kind: 'queued',
      seconds: Math.max(0, secondsSince(myEntry.joinedAt)),
      count: queued.length,
      needed: teamSize ? teamSize * 2 : null,
    };
  }
  if (queued.length > 0) return { kind: 'waiting', players: queued };
  return null;
}

function useQueueAction(orgId: string, leagueId: string, onDone?: () => void) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (input: { action: QueueActionName; matchId?: string }) =>
      queueActionFn({ data: { ...input, orgId, leagueId } }),
    onSuccess: (result) => {
      if (result.status === 'error') {
        setError(result.message);
      } else {
        setError(null);
        onDone?.();
      }
    },
    onError: () => setError('Could not update the queue'),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queueQueryKey(orgId, leagueId),
      }),
  });
  return {
    mutate: mutation.mutate,
    isPending: mutation.isPending,
    error,
  };
}

function pillName(state: Exclude<LiveState, { kind: 'pending' }>): string {
  if (state.kind === 'waiting') return `${state.players.length} in queue`;
  if (state.kind === 'queued') {
    return state.needed
      ? `In queue · ${state.count} of ${state.needed} players`
      : `In queue · ${state.count} players`;
  }
  return `Live match · ${state.minutes} min`;
}

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 shrink-0 rounded-full motion-safe:animate-pulse',
        className
      )}
    />
  );
}

function QueueRing({
  count,
  needed,
  small = false,
}: {
  count: number;
  needed: number | null;
  small?: boolean;
}) {
  const circumference = 2 * Math.PI * 16;
  const filled = needed ? Math.min(1, count / needed) : 0;
  return (
    <span
      aria-hidden="true"
      className={cn('relative flex shrink-0', small ? 'size-4' : 'size-10')}
    >
      <svg
        viewBox="0 0 40 40"
        className={cn('-rotate-90', small ? 'size-4' : 'size-10')}
      >
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          strokeWidth={small ? 7 : 4}
          className="stroke-muted"
        />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          strokeWidth={small ? 7 : 4}
          strokeLinecap="round"
          strokeDasharray={`${filled * circumference} ${circumference}`}
          className="stroke-primary"
        />
      </svg>
      {small ? null : (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
          {needed ? `${count}/${needed}` : count}
        </span>
      )}
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
