import { Fragment, useState } from 'react';
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

    // Fetch one extra: "did we get 26 back" is the only has-more signal, there
    // is no total count.
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
      // Pinned server-side so `groupMatchesByDate` buckets identically on the
      // server and after hydration. Never replace with a client `Date.now()`.
      now: Date.now(),
    };
  });

const deleteMatchFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { orgSlug: string; leagueSlug: string; matchId: string }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!data.matchId)
      return { success: false, message: 'matchId required' };

    const apiClientV3 = await requireApiClientV3();
    const ctx = await resolveOrgAndLeagueIds(apiClientV3, data);
    if (!ctx) return { success: false, message: 'Org or league not found' };

    try {
      await apiClientV3.matchesApi.deleteMatch(
        ctx.orgId,
        ctx.leagueId,
        data.matchId
      );
      return { success: true, message: 'Match deleted' };
    } catch (err) {
      const { message } = await getApiErrorDetails(
        err,
        'Failed to delete match'
      );
      return { success: false, message };
    }
  });

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
      return { success: false, message: 'matchId and teams are required' };

    const apiClientV3 = await requireApiClientV3();
    const ctx = await resolveOrgAndLeagueIds(apiClientV3, data);
    if (!ctx) return { success: false, message: 'Org or league not found' };

    try {
      await apiClientV3.matchesApi.updateMatch(
        ctx.orgId,
        ctx.leagueId,
        data.matchId,
        { teams: data.teams }
      );
      return { success: true, message: 'Match updated' };
    } catch (err) {
      const { message } = await getApiErrorDetails(
        err,
        'Failed to update match'
      );
      return { success: false, message };
    }
  });

const recalculateMatchesFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgSlug: string;
      leagueSlug: string;
      fromMatchId?: string;
    }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const fromMatchId = data.fromMatchId?.trim()
      ? data.fromMatchId.trim()
      : undefined;

    const apiClientV3 = await requireApiClientV3();
    const ctx = await resolveOrgAndLeagueIds(apiClientV3, data);
    if (!ctx) return { success: false, message: 'Org or league not found' };

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
      const { message } = await getApiErrorDetails(
        err,
        'Failed to recalculate MMR'
      );
      return { success: false, message };
    }
  });

export const Route = createFileRoute(
  '/admin/$orgSlug/leagues/$leagueSlug/matches'
)({
  // `offset` stays optional so page 1 keeps the bare `/matches` URL; the
  // parsing rule (`Math.max(0, parseInt(...) || 0)`) is the Svelte load's.
  validateSearch: (search: Record<string, unknown>): { offset?: number } => {
    const raw = search.offset;
    if (raw === undefined || raw === null || raw === '') return {};
    const offset = Math.max(0, parseInt(String(raw), 10) || 0);
    return offset === 0 ? {} : { offset };
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
  errorComponent: HttpErrorView,
  component: AdminMatchesPage,
});

function AdminMatchesPage() {
  const { orgSlug, leagueSlug } = Route.useParams();
  const data = Route.useLoaderData();
  const router = useRouter();
  // The row actions and the season recalc are client-only, so they stay
  // disabled until hydration attaches their handlers — a click on the SSR'd
  // markup would otherwise be dropped without feedback.
  const hydrated = useHydrated();

  const [result, setResult] = useState<ActionResult | null>(null);
  const [editing, setEditing] = useState<MatchResponse | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const prevOffset = Math.max(0, data.offset - data.pageSize);
  const nextOffset = data.offset + data.pageSize;
  const matchGroups = groupMatchesByDate(data.matches, data.now);

  const run = async (action: Promise<ActionResult>) => {
    const actionResult = await action;
    setResult(actionResult);
    await router.invalidate();
    return actionResult;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {/* level 2 — the sub-nav tab shares this accessible name. */}
            <h2 className="text-xl font-semibold">Matches</h2>
            <p className="text-sm text-muted-foreground">
              Edit, delete, and recalculate MMR for matches in the current
              season. Edits leave rating history untouched — recalc to flow
              through to the leaderboard.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!window.confirm('Replay every match in the current season?'))
                return;
              void run(
                recalculateMatchesFn({ data: { orgSlug, leagueSlug } })
              );
            }}
          >
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={!hydrated}
            >
              <RefreshCw className="h-4 w-4" />
              Recalculate season
            </Button>
          </form>
        </div>

        {result?.success ? (
          <Alert variant="success">{result.message}</Alert>
        ) : result?.success === false ? (
          <Alert variant="destructive">{result.message}</Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Recent matches</CardTitle>
            <CardDescription>
              Showing {data.matches.length} from offset {data.offset}
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
                      {/* Sibling of the row, never a wrapper: `admin-match-row`
                          must still count 25 on a full page. */}
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
                              // A snapshot captured at click time — the dialog
                              // must never re-seed from refetched list data.
                              setEditing(match);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {/* No confirm here — unlike the identical-looking
                              Recalc on a flag card. */}
                          <form
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
                              name="fromMatchId"
                              value={match.id}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              disabled={!hydrated}
                              data-testid="admin-match-recalculate"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Recalc
                            </Button>
                          </form>
                          <form
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
                              name="matchId"
                              value={match.id}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              disabled={!hydrated}
                              className="text-destructive hover:text-destructive"
                              data-testid="admin-match-delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
            <Button asChild variant="outline" size="sm" disabled>
              <a href="#">
                <ChevronLeft className="h-4 w-4" />
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
                <ChevronLeft className="h-4 w-4" />
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
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" disabled>
              <a href="#">
                Older
                <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Always mounted, outside the main div. */}
      <EditMatchDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        match={editing}
        leaguePlayers={data.leaguePlayers}
        onSave={({ matchId, teams }) =>
          run(
            editMatchFn({ data: { orgSlug, leagueSlug, matchId, teams } })
          )
        }
      />
    </>
  );
}
