import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  getRouteApi,
  notFound,
  useRouter,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ActiveMatchPage } from '@/components/play/active-match-page';
import { failServerAction } from '@/lib/server/action-result';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type { LeagueContext } from './route';
import type { ActiveMatchResponse } from '@/api-v3';

const leagueRoute = getRouteApi('/_authed/$orgSlug/$leagueSlug');

/** The API only exposes the list, so select the requested match here. */
const getActiveMatchFn = createServerFn({ method: 'GET' })
  .validator(
    (input: { orgId: string; leagueId: string; activeMatchId: string }) => input
  )
  .handler(async ({ data }): Promise<ActiveMatchResponse | null> => {
    const apiClientV3 = await requireApiClientV3();
    const activeMatches = await apiClientV3.activeMatchesApi.listActiveMatches(
      data.orgId,
      data.leagueId
    );
    return activeMatches.find((m) => m.id === data.activeMatchId) ?? null;
  });

type SubmitResultOutcome =
  { status: 'error'; message: string } | { status: 'ok' };

const submitActiveMatchResultFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgId: string;
      leagueId: string;
      activeMatchId: string;
      team1Score: number;
      team2Score: number;
    }) => input
  )
  .handler(async ({ data }): Promise<SubmitResultOutcome> => {
    const team1Score = Number(data.team1Score);
    const team2Score = Number(data.team2Score);

    if (isNaN(team1Score) || isNaN(team2Score)) {
      return failServerAction(400, {
        status: 'error',
        message: 'Scores are required',
      });
    }

    if (!data.orgId || !data.leagueId) {
      return failServerAction(400, {
        status: 'error',
        message: 'Organization and league are required',
      });
    }

    const teams = [
      { teamIndex: 0, score: team1Score },
      { teamIndex: 1, score: team2Score },
    ];

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.activeMatchesApi.submitResult(
        data.orgId,
        data.leagueId,
        data.activeMatchId,
        { teams }
      );
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to submit match result'
      );
      return failServerAction(status, { status: 'error', message });
    }

    return { status: 'ok' };
  });

export const Route = createFileRoute(
  '/_authed/$orgSlug/$leagueSlug/active-match/$id'
)({
  loader: async ({ context, params }) => {
    const { orgId, leagueId } = context.league;
    const activeMatch = await getActiveMatchFn({
      data: { orgId, leagueId, activeMatchId: params.id },
    });
    if (!activeMatch) throw notFound();
    return { activeMatch };
  },
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-muted-foreground">Active match not found</p>
    </div>
  ),
  component: ActiveMatchRoute,
});

function ActiveMatchRoute() {
  const league = leagueRoute.useLoaderData();
  const { activeMatch } = Route.useLoaderData();
  const { id } = Route.useParams();

  return (
    <LeagueActiveMatchRoute
      key={`${league.leagueId}:${id}`}
      league={league}
      activeMatch={activeMatch}
      id={id}
    />
  );
}

function LeagueActiveMatchRoute({
  league,
  activeMatch,
  id,
}: {
  league: LeagueContext;
  activeMatch: ActiveMatchResponse;
  id: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const submitResult = useMutation({
    mutationFn: (scores: { team1Score: number; team2Score: number }) =>
      submitActiveMatchResultFn({
        data: {
          orgId: league.orgId,
          leagueId: league.leagueId,
          activeMatchId: id,
          ...scores,
        },
      }),
    onSuccess: async (result) => {
      if (result.status === 'error') {
        setFormMessage(result.message);
        return;
      }
      setFormMessage(null);
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes(league.leagueId),
      });
      await router.navigate({
        href: `/${league.orgSlug}/${league.leagueSlug}`,
      });
    },
    onError: () => setFormMessage('Failed to submit match result'),
  });

  return (
    <ActiveMatchPage
      activeMatch={activeMatch}
      currentLeaguePlayerId={league.leaguePlayerId}
      leagueWinningScore={league.leagueWinningScore}
      formMessage={formMessage}
      submitting={submitResult.isPending}
      onSubmit={(scores) => submitResult.mutate(scores)}
      onGoToStep={(hash) => {
        void router.navigate({
          href: `${window.location.pathname}${window.location.search}#${hash}`,
        });
      }}
    />
  );
}
