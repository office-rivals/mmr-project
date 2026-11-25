import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { HttpErrorView } from '@/components/http-error-view';
import { MatchCard } from '@/components/match-card';
import { PageTitle } from '@/components/page-title';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  ownGoalLabel,
  playerName,
  scorerLabel,
  scorerOptions,
  sinceFirstGoal,
} from '@/features/foosball/goals';
import { failServerAction } from '@/lib/server/action-result';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type { MatchResponse } from '@/api-v3/models';
import type {
  MatchGoalResponse,
  MatchGoalsResponse,
} from '@/features/foosball/api';

type Ids = { orgId: string; leagueId: string; matchId: string };

const loadMatchFn = createServerFn({ method: 'GET' })
  .validator((ids: Ids) => ids)
  .handler(
    async ({
      data: { orgId, leagueId, matchId },
    }): Promise<{ match: MatchResponse; goals: MatchGoalsResponse | null }> => {
      const { matchesApi, foosballApi } = await requireApiClientV3();
      const [match, goals] = await Promise.all([
        matchesApi.getMatch(orgId, leagueId, matchId),
        // Only table-scored matches have a goal list.
        foosballApi
          .listMatchGoals(orgId, leagueId, matchId)
          .catch((err: { response?: Response }) => {
            if (err.response?.status === 404) return null;
            throw err;
          }),
      ]);
      return { match, goals };
    }
  );

const setScorerFn = createServerFn({ method: 'POST' })
  .validator(
    (input: Ids & { goalId: string; leaguePlayerId: string | null }) => input
  )
  .handler(async ({ data }): Promise<{ error?: string }> => {
    try {
      await (
        await requireApiClientV3()
      ).foosballApi.setGoalScorer(
        data.orgId,
        data.leagueId,
        data.matchId,
        data.goalId,
        data.leaguePlayerId
      );
      return {};
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to save the scorer'
      );
      return failServerAction(status, { error: message });
    }
  });

export const Route = createFileRoute('/_authed/$orgSlug/$leagueSlug/match/$id')(
  {
    loader: ({ context, params }) =>
      loadMatchFn({
        data: {
          orgId: context.league.orgId,
          leagueId: context.league.leagueId,
          matchId: params.id,
        },
      }),
    errorComponent: HttpErrorView,
    component: MatchPage,
  }
);

function MatchPage() {
  const { match, goals } = Route.useLoaderData();
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Match</PageTitle>
      <MatchCard match={match} showMmr />
      {goals && <Goals match={match} goals={goals} />}
    </div>
  );
}

function Goals({
  match,
  goals: { goals, tableName, canEdit },
}: {
  match: MatchResponse;
  goals: MatchGoalsResponse;
}) {
  const { league } = Route.useRouteContext();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const setScorer = useMutation({
    mutationFn: (input: { goalId: string; leaguePlayerId: string | null }) =>
      setScorerFn({
        data: {
          orgId: league.orgId,
          leagueId: league.leagueId,
          matchId: match.id,
          ...input,
        },
      }),
    onSuccess: async (result) => {
      setError(result.error ?? null);
      if (!result.error) await router.invalidate();
    },
    onError: () => setError('Failed to save the scorer'),
  });

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl">Goals</h2>
        <p className="text-sm text-muted-foreground">
          Played on {tableName}.
          {canEdit && ' You can set or fix who scored each goal.'}
        </p>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      <ol className="flex flex-col divide-y rounded-lg border">
        {goals.map((goal) => (
          <li key={goal.id} className="flex items-center gap-3 px-3 py-2">
            <span
              className="w-12 text-sm text-muted-foreground tabular-nums"
              title="Time since the first goal"
            >
              {sinceFirstGoal(goal.at, goals[0].at)}
            </span>
            <span className="w-14 font-semibold tabular-nums">
              <span className={cn(goal.teamIndex === 0 && 'text-primary')}>
                {goal.scoreA}
              </span>
              –
              <span className={cn(goal.teamIndex === 1 && 'text-primary')}>
                {goal.scoreB}
              </span>
            </span>
            <span className="min-w-0 flex-1 truncate">
              {canEdit ? (
                <ScorerSelect
                  match={match}
                  goal={goal}
                  disabled={setScorer.isPending}
                  onChange={(leaguePlayerId) =>
                    setScorer.mutate({ goalId: goal.id, leaguePlayerId })
                  }
                />
              ) : (
                (scorerLabel(match, goal) ?? (
                  <span className="text-muted-foreground">Unknown scorer</span>
                ))
              )}
            </span>
          </li>
        ))}
      </ol>
      {goals.length === 0 && (
        <p className="text-sm text-muted-foreground">No goals recorded.</p>
      )}
    </section>
  );
}

function ScorerSelect({
  match,
  goal,
  disabled,
  onChange,
}: {
  match: MatchResponse;
  goal: MatchGoalResponse;
  disabled: boolean;
  onChange: (leaguePlayerId: string | null) => void;
}) {
  const { scored, ownGoal } = scorerOptions(match, goal);
  return (
    <select
      aria-label={`Who scored ${goal.scoreA}–${goal.scoreB}?`}
      value={goal.scorerLeaguePlayerId ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="">Unknown scorer</option>
      <optgroup label="Scored">
        {scored.map((p) => (
          <option key={p.leaguePlayerId} value={p.leaguePlayerId}>
            {playerName(p)}
          </option>
        ))}
      </optgroup>
      <optgroup label="Own goal">
        {ownGoal.map((p) => (
          <option key={p.leaguePlayerId} value={p.leaguePlayerId}>
            {ownGoalLabel(playerName(p))}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
