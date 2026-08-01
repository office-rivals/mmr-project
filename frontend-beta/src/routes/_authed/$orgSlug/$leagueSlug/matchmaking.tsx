import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { LoaderCircle, Pause, Play } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { PageTitle } from '@/components/page-title';
import { PendingMatchDialog } from '@/components/play/pending-match-dialog';
import { queueQueryKey } from '@/components/shell/matchmaking-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/use-hydrated';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { formatLeagueFormat } from '@/lib/utils';
import type { ActiveMatchResponse, QueueStatusResponse } from '@/api-v3';

const leagueRoute = getRouteApi('/_authed/$orgSlug/$leagueSlug');

const activeMatchesQueryKey = (orgId: string, leagueId: string) =>
  ['league', orgId, leagueId, 'activeMatches'] as const;

interface OrgLeagueInput {
  orgId: string;
  leagueId: string;
}

/** Both calls degrade silently — neither one may ever error the page. */
const getMatchmakingDataFn = createServerFn({ method: 'GET' })
  .validator((input: OrgLeagueInput) => input)
  .handler(
    async ({
      data,
    }): Promise<{
      queueStatus: QueueStatusResponse | null;
      activeMatches: ActiveMatchResponse[];
    }> => {
      const apiClientV3 = await requireApiClientV3();
      const [queueStatus, activeMatches] = await Promise.all([
        apiClientV3.queueApi
          .getQueueStatus(data.orgId, data.leagueId)
          .catch(() => null),
        apiClientV3.activeMatchesApi
          .listActiveMatches(data.orgId, data.leagueId)
          .catch(() => [] as ActiveMatchResponse[]),
      ]);
      return { queueStatus, activeMatches };
    }
  );

const listActiveMatchesFn = createServerFn({ method: 'GET' })
  .validator((input: OrgLeagueInput) => input)
  .handler(async ({ data }): Promise<ActiveMatchResponse[]> => {
    const apiClientV3 = await requireApiClientV3();
    return apiClientV3.activeMatchesApi.listActiveMatches(
      data.orgId,
      data.leagueId
    );
  });

type QueueActionResult =
  { status: 'error'; message: string } | { status: 'ok' };

type QueueActionName = 'join' | 'leave' | 'accept' | 'decline';

const TRANSPORT_FALLBACKS: Record<QueueActionName, string> = {
  join: 'Failed to join queue',
  leave: 'Failed to leave queue',
  accept: 'Failed to accept match',
  decline: 'Failed to decline match',
};

const queueActionFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      action: QueueActionName;
      orgId: string;
      leagueId: string;
      matchId?: string;
    }) => input
  )
  .handler(async ({ data }): Promise<QueueActionResult> => {
    const needsMatchId = data.action === 'accept' || data.action === 'decline';
    if (needsMatchId && !data.matchId) {
      return { status: 'error', message: 'Match ID is required' };
    }
    if (!data.orgId || !data.leagueId) {
      return {
        status: 'error',
        message: 'Organization and league are required',
      };
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
      const { message } = await getApiErrorDetails(
        error,
        TRANSPORT_FALLBACKS[data.action]
      );
      return { status: 'error', message };
    }

    return { status: 'ok' };
  });

export const Route = createFileRoute(
  '/_authed/$orgSlug/$leagueSlug/matchmaking'
)({
  loader: ({ context }) => {
    const { orgId, leagueId } = context.league;
    return getMatchmakingDataFn({ data: { orgId, leagueId } });
  },
  component: MatchmakingRoute,
});

function MatchmakingRoute() {
  const league = leagueRoute.useLoaderData();
  const { orgId, leagueId, leaguePlayerId, orgSlug, leagueSlug } = league;
  const seed = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  // The queue forms are un-enhanced markup until React attaches `onSubmit`:
  // the SSR'd button paints and is clickable well before hydration finishes,
  // and a click landing in that window submits nothing and is never replayed.
  // Keep both queue buttons disabled until the page is actually interactive.
  const hydrated = useHydrated();

  const playersRequiredForMatch = league.leagueTeamSize * 2;
  const formatLabel = formatLeagueFormat(league.leagueTeamSize);
  const hasLeaguePlayer = !!leaguePlayerId;

  // Same cache entry as the navbar badge (`queueQueryKey`), only polled faster.
  // In the Svelte app this poll was dead code — no proxy route existed for the
  // URL it fetched — so the queue never live-updated and the "match found"
  // sound never played. The route exists here, so it now works.
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

  // Deliberate fix, not parity: the Svelte page copied `data.activeMatches`
  // into `$state` once and never updated it, so the list was frozen at the
  // first server render even though the poll called `invalidateAll()`. As a
  // query it live-updates, which is what the original code was reaching for.
  const activeMatchesQuery = useQuery({
    queryKey: activeMatchesQueryKey(orgId, leagueId),
    queryFn: () => listActiveMatchesFn({ data: { orgId, leagueId } }),
    initialData: seed.activeMatches,
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

  // 250 ms tick for the countdown only — deliberately not a 4 Hz refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(ticker);
  }, []);
  const secondsRemaining = pendingMatch
    ? Math.max(
        0,
        Math.ceil((new Date(pendingMatch.expiresAt).getTime() - now) / 1000)
      )
    : 0;

  // Ding once per *new* pending match this user is part of. Seeded from the
  // loader so an already-open pending match doesn't play on mount, and always
  // inside try/catch because autoplay is blocked before any user gesture.
  const lastPendingMatchId = useRef<string | null>(
    seed.queueStatus?.pendingMatch?.id ?? null
  );
  useEffect(() => {
    const id = pendingMatch?.id ?? null;
    if (id && id !== lastPendingMatchId.current && pendingForMe) {
      try {
        void new Audio('/sounds/match-found.mp3').play().catch(() => {});
      } catch {
        // Autoplay may be blocked; ignore.
      }
    }
    lastPendingMatchId.current = id;
  }, [pendingMatch?.id, pendingForMe]);

  // The Svelte poll called `invalidateAll()` once an active match appeared;
  // here the equivalent is refreshing the active-match list.
  const activeMatchId = queueStatus?.activeMatch?.id;
  useEffect(() => {
    if (!activeMatchId) return;
    void queryClient.invalidateQueries({
      queryKey: activeMatchesQueryKey(orgId, leagueId),
    });
  }, [activeMatchId, orgId, leagueId, queryClient]);

  const queueAction = useMutation({
    mutationFn: (input: { action: QueueActionName; matchId?: string }) =>
      queueActionFn({ data: { ...input, orgId, leagueId } }),
    onSuccess: (result) => {
      setFormMessage(result.status === 'error' ? result.message : null);
    },
    // Only reachable when the RPC itself fails; API errors come back as
    // `{ status: 'error' }` with the message the server resolved.
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

  return (
    <>
      <PageTitle>Matchmaking</PageTitle>

      {formMessage ? <Alert variant="destructive">{formMessage}</Alert> : null}

      <div className="mt-6 flex flex-col gap-4">
        <p>
          Matchmaking is a feature where you queue up for a {formatLabel} game
          against other people that are also ready for a game.
        </p>
        <p>
          Once <strong>{playersRequiredForMatch} players</strong> are in the
          queue, a match will be created and you will be notified.
        </p>
        <p>
          {/* The server window is actually 31 s; the copy has always said 30. */}
          If you do not accept the match within <strong>30 seconds</strong>, you
          will be removed from the queue.
        </p>
        <p>A sound will play when a match is found.</p>

        {!hasLeaguePlayer ? (
          <p>You need to join this league before you can queue for matches.</p>
        ) : isInQueue ? (
          <>
            <div className="flex gap-2">
              <LoaderCircle className="animate-spin" />
              <p>Waiting for a match...</p>
            </div>
            <p>Missing {remainingPlayers} more players</p>
            <form onSubmit={submitAction('leave')}>
              <Button
                variant="destructive"
                type="submit"
                className="w-full"
                disabled={!hydrated || queueAction.isPending}
              >
                <Pause />
                <span className="ml-2">Leave queue</span>
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={submitAction('join')}>
            <Button
              size="lg"
              className="w-full py-6"
              type="submit"
              disabled={!hydrated || queueAction.isPending}
            >
              <Play />
              <span className="ml-2 text-xl">Queue up</span>
            </Button>
          </form>
        )}

        {/* No empty state: the whole block is omitted when there are none. */}
        {activeMatches.length > 0 ? (
          <>
            <h2 className="mt-4 text-2xl">Active matches</h2>
            {activeMatches.map((match) => (
              <div className="rounded-lg border bg-card p-4" key={match.id}>
                <div className="flex items-center justify-around gap-2">
                  {(match.teams ?? []).map((team) => (
                    <div
                      className="flex flex-col items-center gap-1"
                      key={team.index}
                    >
                      {(team.players ?? []).map((player) => (
                        <span key={player.leaguePlayerId}>
                          {player.displayName ?? player.username ?? 'Unknown'}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-center">
                  <Button asChild variant="outline" size="sm">
                    <AppLink
                      to={`/${orgSlug}/${leagueSlug}/active-match/${match.id}`}
                    >
                      Submit Result
                    </AppLink>
                  </Button>
                </div>
              </div>
            ))}
          </>
        ) : null}
      </div>

      <PendingMatchDialog
        open={pendingForMe}
        pendingMatch={pendingMatch}
        myAcceptance={myAcceptance}
        secondsRemaining={secondsRemaining}
        responding={queueAction.isPending}
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
