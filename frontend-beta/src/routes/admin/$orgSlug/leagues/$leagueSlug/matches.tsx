import { Fragment, useEffect, useState } from 'react';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { EditMatchDialog } from '@/components/admin/edit-match-dialog';
import { MatchCard } from '@/components/match-card/match-card';
import { MatchDateHeader } from '@/components/match-card/match-date-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { HttpErrorView } from '@/components/http-error-view';
import { useHydrated } from '@/hooks/use-hydrated';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireAdminOrg, resolveOrgAndLeagueIds } from '@/lib/server/admin';
import { groupMatchesByDate } from '@/lib/utils';
import type { EditMatchTeamPayload } from '@/components/admin/edit-match-dialog';
import type { LeaguePlayerResponse, MatchResponse } from '@/api-v3';

const PAGE_SIZE = 25;

type ActionResult = { success: boolean; message: string };

interface MatchesPageData {
  matches: MatchResponse[];
  leaguePlayers: LeaguePlayerResponse[];
  pageSize: number;
  offset: number;
  hasMore: boolean;
  latestMatchId: string | null;
  now: number;
}

const loadMatchesFn = createServerFn({ method: 'GET' })
  .validator(
    (input: { orgSlug: string; leagueId: string; offset: number }) => input
  )
  .handler(async ({ data }): Promise<MatchesPageData> => {
    const org = await requireAdminOrg(data.orgSlug);
    const apiClientV3 = await requireApiClientV3();

    // The API has no total count, so one extra row is the has-more signal.
    const [matches, leaguePlayers] = await Promise.all([
      apiClientV3.matchesApi.getMatches(org.id, data.leagueId, {
        limit: PAGE_SIZE + 1,
        offset: data.offset,
      }),
      apiClientV3.leaguePlayersApi.listPlayers(org.id, data.leagueId),
    ]);

    const hasMore = matches.length > PAGE_SIZE;
    const trimmed = matches.slice(0, PAGE_SIZE);

    return {
      matches: trimmed,
      leaguePlayers,
      pageSize: PAGE_SIZE,
      offset: data.offset,
      hasMore,
      latestMatchId: data.offset === 0 ? (trimmed[0]?.id ?? null) : null,
      // Pin the clock so server and hydrated date buckets agree.
      now: Date.now(),
    };
  });

interface DeleteMatchInput {
  orgSlug: string;
  leagueSlug: string;
  matchId: string;
}

async function deleteMatch(data: DeleteMatchInput): Promise<ActionResult> {
  if (!data.matchId)
    return failServerAction(400, {
      success: false,
      message: 'matchId required',
    });

  const apiClientV3 = await requireApiClientV3();
  const ctx = await resolveOrgAndLeagueIds(apiClientV3, data);
  if (!ctx)
    return failServerAction(404, {
      success: false,
      message: 'Org or league not found',
    });

  try {
    await apiClientV3.matchesApi.deleteMatch(
      ctx.orgId,
      ctx.leagueId,
      data.matchId
    );
    return { success: true, message: 'Match deleted' };
  } catch (err) {
    const { status, message } = await getApiErrorDetails(
      err,
      'Failed to delete match'
    );
    return failServerAction(status, { success: false, message });
  }
}

const deleteMatchFn = createServerFn({ method: 'POST' })
  .validator((input: DeleteMatchInput) => input)
  .handler(({ data }): Promise<ActionResult> => deleteMatch(data));

const editMatchFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgSlug: string;
      leagueSlug: string;
      matchId: string;
      teams: EditMatchTeamPayload[];
    }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!data.matchId || !data.teams)
      return failServerAction(400, {
        success: false,
        message: 'matchId and teams are required',
      });

    const apiClientV3 = await requireApiClientV3();
    const ctx = await resolveOrgAndLeagueIds(apiClientV3, data);
    if (!ctx)
      return failServerAction(404, {
        success: false,
        message: 'Org or league not found',
      });

    try {
      await apiClientV3.matchesApi.updateMatch(
        ctx.orgId,
        ctx.leagueId,
        data.matchId,
        { teams: data.teams }
      );
      return { success: true, message: 'Match updated' };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to update match'
      );
      return failServerAction(status, { success: false, message });
    }
  });

interface RecalculateMatchesInput {
  orgSlug: string;
  leagueSlug: string;
  fromMatchId?: string;
}

async function recalculateMatches(
  data: RecalculateMatchesInput
): Promise<ActionResult> {
  const fromMatchId = data.fromMatchId?.trim()
    ? data.fromMatchId.trim()
    : undefined;

  const apiClientV3 = await requireApiClientV3();
  const ctx = await resolveOrgAndLeagueIds(apiClientV3, data);
  if (!ctx)
    return failServerAction(404, {
      success: false,
      message: 'Org or league not found',
    });

  try {
    const result = await apiClientV3.matchesApi.recalculateMatches(
      ctx.orgId,
      ctx.leagueId,
      fromMatchId
    );
    return {
      success: true,
      message: `Recalculated ${result.matchCount} match${result.matchCount === 1 ? '' : 'es'}`,
    };
  } catch (err) {
    const { status, message } = await getApiErrorDetails(
      err,
      'Failed to recalculate MMR'
    );
    return failServerAction(status, { success: false, message });
  }
}

const recalculateMatchesFn = createServerFn({ method: 'POST' })
  .validator((input: RecalculateMatchesInput) => input)
  .handler(({ data }): Promise<ActionResult> => recalculateMatches(data));

export const Route = createFileRoute(
  '/admin/$orgSlug/leagues/$leagueSlug/matches'
)({
  // Keep page 1 at the bare `/matches` URL.
  validateSearch: (
    search: Record<string, unknown>
  ): { offset?: number; actionSuccess?: string } => {
    const raw = search.offset;
    const actionSuccess =
      typeof search.actionSuccess === 'string'
        ? search.actionSuccess
        : undefined;
    if (raw === undefined || raw === null || raw === '') {
      return actionSuccess ? { actionSuccess } : {};
    }
    const offset = Math.max(0, parseInt(String(raw), 10) || 0);
    return {
      ...(offset === 0 ? {} : { offset }),
      ...(actionSuccess ? { actionSuccess } : {}),
    };
  },
  loaderDeps: ({ search }) => ({ offset: search.offset ?? 0 }),
  loader: ({ context, deps, params }) =>
    loadMatchesFn({
      data: {
        orgSlug: params.orgSlug,
        leagueId: context.leagueId,
        offset: deps.offset,
      },
    }),
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const formData = await parseNativeFormData(request);
        let actionResult: ActionResult;
        try {
          switch (formData.get('_action')) {
            case 'recalculate':
              actionResult = await recalculateMatches({
                orgSlug: params.orgSlug,
                leagueSlug: params.leagueSlug,
                fromMatchId:
                  String(formData.get('fromMatchId') ?? '').trim() || undefined,
              });
              break;
            case 'delete':
              actionResult = await deleteMatch({
                orgSlug: params.orgSlug,
                leagueSlug: params.leagueSlug,
                matchId: String(formData.get('matchId') ?? ''),
              });
              break;
            default:
              return new Response('Unsupported form action', { status: 400 });
          }
        } catch {
          actionResult = failServerAction(500, {
            success: false,
            message: 'Request failed. Please try again.',
          });
        }
        return nativeFormResponse(request, actionResult);
      },
    },
  },
  errorComponent: HttpErrorView,
  component: AdminMatchesPage,
});

function AdminMatchesPage() {
  const { orgSlug, leagueSlug } = Route.useParams();
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const router = useRouter();
  const hydrated = useHydrated();

  const [result, setResult] = useState<ActionResult | null>(() =>
    search.actionSuccess
      ? { success: true, message: search.actionSuccess }
      : null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    setResult(
      search.actionSuccess
        ? { success: true, message: search.actionSuccess }
        : null
    );
  }, [orgSlug, leagueSlug, data.offset, search.actionSuccess]);

  // Use refreshed scores when an older save finishes after the dialog reopens.
  const editing = data.matches.find((match) => match.id === editingId) ?? null;

  const prevOffset = Math.max(0, data.offset - data.pageSize);
  const nextOffset = data.offset + data.pageSize;
  const matchGroups = groupMatchesByDate(data.matches, data.now);

  const run = async (action: Promise<ActionResult>) => {
    let actionResult: ActionResult;
    try {
      actionResult = await action;
    } catch {
      actionResult = {
        success: false,
        message: 'Request failed. Please try again.',
      };
    }
    if (actionResult.success) await router.invalidate({ sync: true });
    setResult(actionResult);
    return actionResult;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Matches</h2>
            <p className="text-sm text-muted-foreground">
              Edit, delete, and recalculate MMR for matches in the current
              season. Edits leave rating history untouched — recalc to flow
              through to the leaderboard.
            </p>
          </div>
          <form
            method="post"
            action={`/admin/${orgSlug}/leagues/${leagueSlug}/matches`}
            onSubmit={(event) => {
              event.preventDefault();
              if (!window.confirm('Replay every match in the current season?'))
                return;
              void run(recalculateMatchesFn({ data: { orgSlug, leagueSlug } }));
            }}
          >
            <input type="hidden" name="_action" value="recalculate" />
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Recalculate season
            </Button>
          </form>
        </div>

        {/* Keep the live region mounted so modal isolation preserves late feedback. */}
        <div aria-live="assertive">
          {result?.success ? (
            <Alert variant="success">{result.message}</Alert>
          ) : result?.success === false ? (
            <Alert variant="destructive">{result.message}</Alert>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent matches</CardTitle>
            <CardDescription>
              {`Showing ${data.matches.length} from offset ${data.offset}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.matches.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No matches at this offset.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {matchGroups.map((group) => {
                  const match = group.match;
                  const isLatest = match.id === data.latestMatchId;
                  return (
                    <Fragment key={match.id}>
                      {group.label && (
                        <MatchDateHeader
                          label={group.label}
                          data-testid="admin-match-date-header"
                        />
                      )}
                      <div
                        className="flex flex-col gap-3 md:flex-row md:items-center"
                        data-testid="admin-match-row"
                        data-match-id={match.id}
                      >
                        <div className="flex-1">
                          <MatchCard match={match} showMmr />
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {isLatest && (
                            <Badge variant="outline" className="text-xs">
                              Latest
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!hydrated}
                            data-testid="admin-match-edit"
                            onClick={() => {
                              setEditingId(match.id);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <form
                            method="post"
                            action={`/admin/${orgSlug}/leagues/${leagueSlug}/matches`}
                            onSubmit={(event) => {
                              event.preventDefault();
                              void run(
                                recalculateMatchesFn({
                                  data: {
                                    orgSlug,
                                    leagueSlug,
                                    fromMatchId: match.id,
                                  },
                                })
                              );
                            }}
                          >
                            <input
                              type="hidden"
                              name="_action"
                              value="recalculate"
                            />
                            <input
                              type="hidden"
                              name="fromMatchId"
                              value={match.id}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              data-testid="admin-match-recalculate"
                            >
                              <RefreshCw className="mr-1 h-3.5 w-3.5" />
                              Recalc
                            </Button>
                          </form>
                          <form
                            data-delete-match=""
                            method="post"
                            action={`/admin/${orgSlug}/leagues/${leagueSlug}/matches`}
                            onSubmit={(event) => {
                              event.preventDefault();
                              const msg = isLatest
                                ? 'Delete this match and roll back its rating impact?'
                                : 'Delete this match? Ratings for downstream matches will be wrong until you recalculate.';
                              if (!window.confirm(msg)) return;
                              void run(
                                deleteMatchFn({
                                  data: {
                                    orgSlug,
                                    leagueSlug,
                                    matchId: match.id,
                                  },
                                })
                              );
                            }}
                          >
                            <input
                              type="hidden"
                              name="_action"
                              value="delete"
                            />
                            <input
                              type="hidden"
                              name="matchId"
                              value={match.id}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              data-testid="admin-match-delete"
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </form>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {data.offset === 0 ? (
            <Button asChild variant="outline" size="sm">
              <a role="link" aria-disabled="true" tabIndex={-1}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Newer
              </a>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link
                to="/admin/$orgSlug/leagues/$leagueSlug/matches"
                params={{ orgSlug, leagueSlug }}
                search={{ offset: prevOffset }}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Newer
              </Link>
            </Button>
          )}
          {data.hasMore ? (
            <Button asChild variant="outline" size="sm">
              <Link
                to="/admin/$orgSlug/leagues/$leagueSlug/matches"
                params={{ orgSlug, leagueSlug }}
                search={{ offset: nextOffset }}
              >
                Older
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <a role="link" aria-disabled="true" tabIndex={-1}>
                Older
                <ChevronRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <EditMatchDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        match={editing}
        leaguePlayers={data.leaguePlayers}
        onSave={({ matchId, teams }) =>
          run(editMatchFn({ data: { orgSlug, leagueSlug, matchId, teams } }))
        }
      />
    </>
  );
}
