import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  Bell,
  ChevronRight,
  Clock,
  LoaderCircle,
  Play,
  Users,
} from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Eyebrow } from '@/components/eyebrow';
import { PageTitle } from '@/components/page-title';
import { PendingMatchDialog } from '@/components/play/pending-match-dialog';
import { WinChance } from '@/components/play/win-chance';
import { PlayerAvatar } from '@/components/player-avatar';
import { queueQueryKey } from '@/components/shell/matchmaking-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { matchOdds } from '@/lib/match-prediction';
import {
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import {
  queueAction,
  queueActionFn,
  TRANSPORT_FALLBACKS,
  type QueueActionName,
} from '@/lib/queue-actions';
import {
  cn,
  formatElapsed,
  formatLeagueFormat,
  getPlayerDisplayName,
} from '@/lib/utils';
import type { LeagueContext } from './route';
import type {
  ActiveMatchResponse,
  PendingMatchTeamResponse,
  QueueStatusResponse,
  QueuedPlayerResponse,
} from '@/api-v3';

const leagueRoute = getRouteApi('/_authed/$orgSlug/$leagueSlug');

const activeMatchesQueryKey = (orgId: string, leagueId: string) =>
  ['league', orgId, leagueId, 'activeMatches'] as const;

interface OrgLeagueInput {
  orgId: string;
  leagueId: string;
}

interface MatchmakingPageData {
  now: number;
  queueStatus: QueueStatusResponse | null;
  activeMatches: ActiveMatchResponse[];
}

// Keep the page available when either optional status call fails.
const getMatchmakingDataFn = createServerFn({ method: 'GET' })
  .validator((input: OrgLeagueInput) => input)
  .handler(async ({ data }): Promise<MatchmakingPageData> => {
    const apiClientV3 = await requireApiClientV3();
    const [queueStatus, activeMatches] = await Promise.all([
      apiClientV3.queueApi
        .getQueueStatus(data.orgId, data.leagueId)
        .catch(() => null),
      apiClientV3.activeMatchesApi
        .listActiveMatches(data.orgId, data.leagueId)
        .catch(() => [] as ActiveMatchResponse[]),
    ]);
    return { queueStatus, activeMatches, now: Date.now() };
  });

const listActiveMatchesFn = createServerFn({ method: 'GET' })
  .validator((input: OrgLeagueInput) => input)
  .handler(async ({ data }): Promise<ActiveMatchResponse[]> => {
    const apiClientV3 = await requireApiClientV3();
    return apiClientV3.activeMatchesApi.listActiveMatches(
      data.orgId,
      data.leagueId
    );
  });

export const Route = createFileRoute(
  '/_authed/$orgSlug/$leagueSlug/matchmaking'
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await parseNativeFormData(request);
        const action = formData.get('_action');
        if (action !== 'join' && action !== 'leave') {
          return new Response('Unsupported form action', { status: 400 });
        }
        const result = await queueAction({
          action,
          orgId: String(formData.get('orgId') ?? ''),
          leagueId: String(formData.get('leagueId') ?? ''),
        });
        return nativeFormResponse(request, {
          ...result,
          success: result.status === 'ok',
        });
      },
    },
  },
  loader: ({ context }) => {
    const { orgId, leagueId } = context.league;
    return getMatchmakingDataFn({ data: { orgId, leagueId } });
  },
  staticData: { wide: true },
  component: MatchmakingRoute,
});

function MatchmakingRoute() {
  const league = leagueRoute.useLoaderData();
  const seed = Route.useLoaderData();

  return <MatchmakingPage key={league.leagueId} league={league} seed={seed} />;
}

function MatchmakingPage({
  league,
  seed,
}: {
  league: LeagueContext;
  seed: MatchmakingPageData;
}) {
  const { orgId, leagueId, leaguePlayerId, orgSlug, leagueSlug } = league;
  const queryClient = useQueryClient();
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const playersRequiredForMatch = league.leagueTeamSize * 2;
  const formatLabel = formatLeagueFormat(league.leagueTeamSize);
  const hasLeaguePlayer = !!leaguePlayerId;

  // Share the navbar cache entry, with faster polling for match discovery.
  const queueQuery = useQuery({
    queryKey: queueQueryKey(orgId, leagueId),
    queryFn: async (): Promise<QueueStatusResponse> => {
      const res = await fetch(
        `/api/v3/organizations/${orgId}/leagues/${leagueId}/queue`
      );
      if (!res.ok) throw new Error(`Queue request failed: ${res.status}`);
      return res.json() as Promise<QueueStatusResponse>;
    },
    initialData: seed.queueStatus ?? undefined,
    refetchInterval: 2000,
    staleTime: 0,
    retry: false,
  });
  const queueStatus = queueQuery.data;

  const activeMatchesQuery = useQuery({
    queryKey: activeMatchesQueryKey(orgId, leagueId),
    queryFn: () => listActiveMatchesFn({ data: { orgId, leagueId } }),
    initialData: seed.activeMatches,
    refetchInterval: 2000,
    staleTime: 0,
    retry: false,
  });
  const activeMatches = activeMatchesQuery.data ?? [];

  const isInQueue = (queueStatus?.queuedPlayers ?? []).some(
    (p) => p.leaguePlayerId === leaguePlayerId
  );
  const playersInQueue = queueStatus?.queuedPlayers?.length ?? 0;
  const remainingPlayers = Math.max(
    playersRequiredForMatch - playersInQueue,
    0
  );

  const pendingMatch = queueStatus?.pendingMatch;
  const pendingForMe =
    !!pendingMatch &&
    pendingMatch.teams.some((t) =>
      t.players.some((p) => p.leaguePlayerId === leaguePlayerId)
    );
  const myAcceptance = pendingMatch?.acceptances.find(
    (a) => a.leaguePlayerId === leaguePlayerId
  );

  // A clock for what is on screen, deliberately not a refetch: the accept
  // countdown, your time in the queue, or the minutes on active matches. With
  // none of them shown the page does not re-render.
  const tickMs = pendingMatch
    ? 250
    : isInQueue
      ? 1000
      : activeMatches.length > 0
        ? 60_000
        : null;
  const [now, setNow] = useState(seed.now);
  useEffect(() => {
    if (tickMs == null) return;
    setNow(Date.now());
    const ticker = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(ticker);
  }, [tickMs]);
  const secondsRemaining = pendingMatch
    ? Math.max(
        0,
        Math.ceil((new Date(pendingMatch.expiresAt).getTime() - now) / 1000)
      )
    : 0;

  // Seed from loader data so an existing pending match stays silent on mount.
  const lastPendingMatchId = useRef<string | null>(
    seed.queueStatus?.pendingMatch?.id ?? null
  );
  useEffect(() => {
    const id = pendingMatch?.id ?? null;
    if (id && id !== lastPendingMatchId.current && pendingForMe) {
      try {
        void new Audio('/sounds/match-found.mp3').play().catch(() => {});
      } catch {
        // Audio playback is optional.
      }
    }
    lastPendingMatchId.current = id;
  }, [pendingMatch?.id, pendingForMe]);

  const queueAction = useMutation({
    mutationFn: (input: { action: QueueActionName; matchId?: string }) =>
      queueActionFn({ data: { ...input, orgId, leagueId } }),
    onSuccess: (result) => {
      setFormMessage(result.status === 'error' ? result.message : null);
    },
    // API failures resolve as action data; this handles RPC transport failures.
    onError: (_error, variables) =>
      setFormMessage(TRANSPORT_FALLBACKS[variables.action]),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queueQueryKey(orgId, leagueId),
        }),
        queryClient.invalidateQueries({
          queryKey: activeMatchesQueryKey(orgId, leagueId),
        }),
      ]);
    },
  });

  const submitAction =
    (action: QueueActionName, matchId?: string) =>
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (queueAction.isPending) return;
      queueAction.mutate({ action, matchId });
    };

  const myEntry = queueStatus?.queuedPlayers?.find(
    (p) => p.leaguePlayerId === leaguePlayerId
  );
  const queuedSeconds = myEntry
    ? Math.max(
        0,
        Math.floor((now - new Date(myEntry.joinedAt).getTime()) / 1000)
      )
    : 0;
  const queued = [...(queueStatus?.queuedPlayers ?? [])].sort(
    (a, b) =>
      Number(b.leaguePlayerId === leaguePlayerId) -
      Number(a.leaguePlayerId === leaguePlayerId)
  );
  const scoreLabel = league.leagueWinningScore
    ? `First to ${league.leagueWinningScore}`
    : 'Any score';
  const queueForm = (action: 'join' | 'leave', button: React.ReactNode) => (
    <form
      method="post"
      action={`/${orgSlug}/${leagueSlug}/matchmaking`}
      onSubmit={submitAction(action)}
    >
      <input hidden type="hidden" name="_action" value={action} />
      <input hidden type="hidden" name="orgId" value={orgId} />
      <input hidden type="hidden" name="leagueId" value={leagueId} />
      {button}
    </form>
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Eyebrow>
            {formatLabel} · {scoreLabel}
          </Eyebrow>
          <PageTitle>Matchmaking</PageTitle>
          <p className="text-sm text-muted-foreground">
            Queue up for a {formatLabel} game against others who are ready to
            play.
          </p>
        </div>

        {formMessage ? (
          <Alert variant="destructive">{formMessage}</Alert>
        ) : null}

        <div
          className={cn(
            'grid gap-6 lg:items-start',
            activeMatches.length > 0
              ? 'lg:grid-cols-[minmax(0,1fr)_22rem]'
              : 'lg:max-w-3xl'
          )}
        >
          {/* From lg the card's contents and the how-it-works list share one bordered grid. */}
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-6 lg:rounded-xl lg:border lg:bg-card lg:p-8">
            <section
              aria-label="Queue"
              className="flex flex-col items-center gap-6 rounded-xl border bg-card p-5 lg:contents"
            >
              <QueueRing
                count={playersInQueue}
                needed={playersRequiredForMatch}
                className="lg:row-span-2 lg:self-center"
              />
              <div className="flex w-full flex-col gap-5">
                <QueueSlots
                  queued={queued}
                  needed={playersRequiredForMatch}
                  me={leaguePlayerId}
                />
                {!hasLeaguePlayer ? (
                  <p className="text-center text-sm lg:text-left">
                    You need to join this league before you can queue for
                    matches.
                  </p>
                ) : isInQueue ? (
                  <>
                    <div className="flex flex-col items-center gap-0.5 text-center text-sm lg:items-start lg:text-left">
                      <p className="flex items-center gap-2 font-semibold">
                        <LoaderCircle
                          aria-hidden="true"
                          className="size-4 animate-spin text-primary"
                        />
                        Waiting for a match...
                      </p>
                      <p className="text-muted-foreground">
                        {remainingPlayers > 0
                          ? `${remainingPlayers} more ${remainingPlayers === 1 ? 'player' : 'players'} needed`
                          : 'Making balanced teams'}
                        {' · '}
                        <span className="tabular-nums">
                          {formatElapsed(queuedSeconds)}
                        </span>
                      </p>
                    </div>
                    {queueForm(
                      'leave',
                      <Button
                        variant="outline"
                        type="submit"
                        className="h-12 w-full text-base font-semibold"
                        disabled={queueAction.isPending}
                      >
                        Leave queue
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-center text-sm text-muted-foreground lg:text-left">
                      {queued.length > 0
                        ? `${namesLine(queued)} ${queued.length === 1 ? 'wants' : 'want'} a game.`
                        : 'Nobody is queued yet. Be the first.'}
                    </p>
                    {queueForm(
                      'join',
                      <Button
                        type="submit"
                        className="h-12 w-full text-base font-bold"
                        disabled={queueAction.isPending}
                      >
                        <Play aria-hidden="true" />
                        <span className="ml-1">Queue up</span>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </section>
            <ul className="flex flex-col gap-3 px-1 text-sm text-muted-foreground lg:col-start-2 lg:border-t lg:px-0 lg:pt-5">
              <li className="flex gap-3">
                <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>
                  Once{' '}
                  <strong className="text-foreground">
                    {playersRequiredForMatch} players
                  </strong>{' '}
                  are in the queue, balanced teams are made and everyone is
                  notified.
                </p>
              </li>
              <li className="flex gap-3">
                <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>
                  Accept within{' '}
                  <strong className="text-foreground">30 seconds</strong> or you
                  leave the queue.
                </p>
              </li>
              <li className="flex gap-3">
                <Bell aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>A sound plays when a match is found.</p>
              </li>
            </ul>
          </div>

          {activeMatches.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl">Live now</h2>
              <div className="flex flex-col gap-3">
                {activeMatches.map((match) => (
                  <ActiveMatchCard
                    key={match.id}
                    match={match}
                    now={now}
                    me={leaguePlayerId}
                    href={`/${orgSlug}/${leagueSlug}/active-match/${match.id}`}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <PendingMatchDialog
        open={pendingForMe}
        pendingMatch={pendingMatch}
        myAcceptance={myAcceptance}
        secondsRemaining={secondsRemaining}
        responding={queueAction.isPending}
        leaguePlayerId={leaguePlayerId}
        formatLabel={`${formatLabel} · ${scoreLabel}`}
        onAccept={() =>
          queueAction.mutate({ action: 'accept', matchId: pendingMatch?.id })
        }
        onDecline={() =>
          queueAction.mutate({ action: 'decline', matchId: pendingMatch?.id })
        }
      />
    </>
  );
}

function namesLine(players: QueuedPlayerResponse[]) {
  const names = players.slice(0, 2).map((p) => getPlayerDisplayName(p));
  const others = players.length - names.length;
  return others > 0
    ? `${names.join(', ')} and ${others} more`
    : names.join(' and ');
}

function QueueRing({
  count,
  needed,
  className,
}: {
  count: number;
  needed: number;
  className?: string;
}) {
  const circumference = 2 * Math.PI * 44;
  const share = Math.min(1, count / needed);
  return (
    <div className={cn('relative size-48 shrink-0 lg:size-56', className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="size-full -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          strokeWidth="5"
          className="stroke-muted"
        />
        {/* A round cap on an empty arc would still draw a dot. */}
        {count > 0 ? (
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${share * circumference} ${circumference}`}
            className="stroke-primary transition-[stroke-dasharray] duration-500"
          />
        ) : null}
      </svg>
      <p className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-6xl leading-none font-bold tabular-nums">
          {count}
          <span className="text-3xl text-muted-foreground">/{needed}</span>
        </span>
        <span className="mt-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          In queue
        </span>
      </p>
    </div>
  );
}

function QueueSlots({
  queued,
  needed,
  me,
}: {
  queued: QueuedPlayerResponse[];
  needed: number;
  me: string | null;
}) {
  const open = Math.max(0, needed - queued.length);
  const slot =
    'flex w-16 flex-col items-center gap-1.5 text-center text-xs lg:w-20';
  return (
    <ul
      aria-label="Queued players"
      className="flex flex-wrap justify-center gap-x-2 gap-y-3 lg:justify-start"
    >
      {queued.map((player) => {
        const isMe = player.leaguePlayerId === me;
        const name = getPlayerDisplayName(player);
        return (
          <li key={player.leaguePlayerId} className={slot}>
            <PlayerAvatar
              name={name}
              highlight={isMe}
              className={cn(
                'size-12 text-sm lg:size-14',
                isMe && 'bg-primary/10'
              )}
            />
            <span
              className={cn(
                'w-full truncate',
                isMe && 'font-semibold text-primary'
              )}
            >
              {isMe ? 'You' : name}
            </span>
          </li>
        );
      })}
      {Array.from({ length: open }, (_, i) => (
        <li key={`open-${i}`} className={cn(slot, 'text-muted-foreground')}>
          <span
            aria-hidden="true"
            className="size-12 rounded-full border border-dashed border-muted-foreground/50 lg:size-14"
          />
          Open
        </li>
      ))}
    </ul>
  );
}

function ActiveMatchCard({
  match,
  now,
  me,
  href,
}: {
  match: ActiveMatchResponse;
  now: number;
  me: string | null;
  href: string;
}) {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(match.startedAt).getTime()) / 60_000)
  );
  const myTeam = (match.teams ?? []).find((t) =>
    t.players.some((p) => p.leaguePlayerId === me)
  );
  const mine = myTeam != null;
  const teamNames = (team: PendingMatchTeamResponse | undefined) =>
    (team?.players ?? []).map((player) => (
      <span key={player.leaguePlayerId} className="truncate">
        {getPlayerDisplayName(player)}
      </span>
    ));
  // The viewer's team goes first, so the odds read as theirs.
  const [left, right] = myTeam
    ? [myTeam, ...match.teams.filter((t) => t !== myTeam)]
    : (match.teams ?? []);
  const odds = matchOdds(match.prediction, me);
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4',
        mine && 'border-green-500/40'
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-green-400 uppercase">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-green-400 motion-safe:animate-pulse"
        />
        In progress · {minutes} min
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-semibold">
        <span className="flex min-w-0 flex-col">{teamNames(left)}</span>
        <span className="text-xs font-normal text-muted-foreground">vs</span>
        <span className="flex min-w-0 flex-col items-end text-right">
          {teamNames(right)}
        </span>
      </div>
      {odds && left ? (
        <WinChance compact odds={odds} teamIndex={left.index} neutral={!mine} />
      ) : null}
      <AppLink
        to={href}
        className="inline-flex items-center gap-1 self-end rounded-sm text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Report result
        <ChevronRight aria-hidden="true" className="size-4" />
      </AppLink>
    </div>
  );
}
