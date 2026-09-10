import { useState } from 'react';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  AlertCircle,
  CheckCircle,
  Flag,
  Pencil,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { EditMatchDialog } from '@/components/admin/edit-match-dialog';
import { MatchCard } from '@/components/match-card/match-card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { HttpErrorView } from '@/components/http-error-view';
import { useHydrated } from '@/hooks/use-hydrated';
import { HttpError } from '@/lib/http-error';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireAdminOrg, resolveOrgAndLeagueIds } from '@/lib/server/admin';
import { formatDate } from '@/lib/utils';
import { MatchFlagStatus } from '@/api-v3/models';
import { ResponseError } from '@/api-v3/runtime';
import type { EditMatchTeamPayload } from '@/components/admin/edit-match-dialog';
import type {
  LeaguePlayerResponse,
  MatchFlagResponse,
  MatchResponse,
} from '@/api-v3';

type ActionResult = { success: boolean; message: string };

const isMatchFlagStatus = (value: string): value is MatchFlagStatus =>
  (Object.values(MatchFlagStatus) as string[]).includes(value);

type FlagStatusFilter = MatchFlagStatus | 'all';

interface FlagsPageData {
  flags: MatchFlagResponse[];
  players: LeaguePlayerResponse[];
  matchesById: Record<string, MatchResponse | null>;
  currentSeasonId: string | null;
  statusFilter: FlagStatusFilter;
  orgId: string;
}

const loadFlagsFn = createServerFn({ method: 'GET' })
  .validator(
    (input: { orgSlug: string; leagueId: string; status: FlagStatusFilter }) =>
      input
  )
  .handler(
    async ({ data }): Promise<{ error: string } | { data: FlagsPageData }> => {
      const org = await requireAdminOrg(data.orgSlug);
      const apiClientV3 = await requireApiClientV3();
      const statusFilter = data.status === 'all' ? undefined : data.status;

      try {
        const [flags, players, currentSeasonId] = await Promise.all([
          apiClientV3.adminMatchFlagsApi.listAllFlags(
            org.id,
            data.leagueId,
            statusFilter
          ),
          apiClientV3.leaguePlayersApi.listPlayers(org.id, data.leagueId),
          // No active season makes every match read-only.
          apiClientV3.seasonsApi
            .getCurrentSeason(org.id, data.leagueId)
            .then((season) => season.id as string | null)
            .catch(() => null),
        ]);

        const uniqueMatchIds = [...new Set(flags.map((flag) => flag.matchId))];
        const matchEntries = await Promise.all(
          uniqueMatchIds.map(async (matchId) => {
            try {
              const match = await apiClientV3.matchesApi.getMatch(
                org.id,
                data.leagueId,
                matchId
              );
              return [matchId, match] as const;
            } catch (err) {
              // Only a 404 means the referenced match was deleted.
              if (err instanceof ResponseError && err.response.status === 404) {
                return [matchId, null] as const;
              }
              throw err;
            }
          })
        );

        return {
          data: {
            flags,
            players,
            matchesById: Object.fromEntries(matchEntries),
            currentSeasonId,
            statusFilter: data.status,
            orgId: org.id,
          },
        };
      } catch {
        return { error: 'Failed to load flags' };
      }
    }
  );

const resolveFlagFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgId: string;
      leagueId: string;
      flagId: string;
      status: string;
      note: string;
    }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const rawStatus = data.status || 'Resolved';
    const note = data.note.trim() || undefined;

    if (!data.flagId || !data.orgId || !data.leagueId) {
      return failServerAction(400, {
        success: false,
        message: 'Flag ID is required',
      });
    }
    if (!isMatchFlagStatus(rawStatus)) {
      return failServerAction(400, {
        success: false,
        message: 'Invalid status',
      });
    }

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.adminMatchFlagsApi.resolveFlag(
        data.orgId,
        data.leagueId,
        data.flagId,
        { status: rawStatus, resolutionNote: note }
      );
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to resolve flag'
      );
      return failServerAction(status, { success: false, message });
    }

    return { success: true, message: 'Flag resolved successfully' };
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
  '/admin/$orgSlug/leagues/$leagueSlug/match-flags'
)({
  // Open is the default, so the common view keeps a bare URL.
  validateSearch: (
    search: Record<string, unknown>
  ): { status?: FlagStatusFilter; actionSuccess?: string } => {
    const raw = search.status;
    const status =
      raw === 'all' || (typeof raw === 'string' && isMatchFlagStatus(raw))
        ? (raw as FlagStatusFilter)
        : undefined;
    const actionSuccess =
      typeof search.actionSuccess === 'string'
        ? search.actionSuccess
        : undefined;
    return {
      ...(status ? { status } : {}),
      ...(actionSuccess ? { actionSuccess } : {}),
    };
  },
  loaderDeps: ({ search }) => ({
    status: search.status ?? MatchFlagStatus.Open,
  }),
  loader: async ({ context, deps, params }) => {
    const result = await loadFlagsFn({
      data: {
        orgSlug: params.orgSlug,
        leagueId: context.leagueId,
        status: deps.status,
      },
    });
    if ('error' in result) throw new HttpError(500, result.error);
    return { ...result.data, leagueId: context.leagueId };
  },
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const formData = await parseNativeFormData(request);
        if (formData.get('_action') !== 'recalculate') {
          return new Response('Unsupported form action', { status: 400 });
        }

        let actionResult: ActionResult;
        try {
          actionResult = await recalculateMatches({
            orgSlug: params.orgSlug,
            leagueSlug: params.leagueSlug,
            fromMatchId:
              String(formData.get('fromMatchId') ?? '').trim() || undefined,
          });
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
  component: MatchFlagsPage,
});

const dateOpts = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
} as const;

const STATUS_META: Record<
  MatchFlagStatus,
  { label: string; icon: typeof Flag; class: string }
> = {
  Open: {
    label: 'Open',
    icon: Flag,
    class:
      'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  Resolved: {
    label: 'Resolved',
    icon: CheckCircle,
    class:
      'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  Dismissed: {
    label: 'Dismissed',
    icon: XCircle,
    class:
      'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
};

const statusTabs: { label: string; value: FlagStatusFilter }[] = [
  { label: 'Open', value: MatchFlagStatus.Open },
  { label: 'Resolved', value: MatchFlagStatus.Resolved },
  { label: 'Dismissed', value: MatchFlagStatus.Dismissed },
  { label: 'All', value: 'all' },
];

function MatchFlagsPage() {
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
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveStatus, setResolveStatus] = useState<string>('Resolved');
  const [editing, setEditing] = useState<MatchResponse | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const selectedFlag = data.flags.find((f) => f.id === selectedFlagId);
  const selectedMatch = selectedFlag
    ? (data.matchesById[selectedFlag.matchId] ?? null)
    : null;

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
    setResult(actionResult);
    if (actionResult.success) await router.invalidate({ sync: true });
    return actionResult;
  };

  function handleResolve(flagId: string) {
    setSelectedFlagId(flagId);
    setResolutionNote('');
    setResolveStatus('Resolved');
    setDialogOpen(true);
  }

  function closeResolveDialog() {
    setDialogOpen(false);
    setSelectedFlagId(null);
    setResolutionNote('');
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flagged Matches</h1>
          <p className="text-muted-foreground">
            Review the flagged match, correct it if needed, then resolve or
            dismiss the flag. Editing a match leaves rating history untouched —
            recalculate to flow the correction through to the leaderboard.
          </p>
        </div>

        {result?.success && result.message ? (
          <Alert variant="default">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">{result.message}</span>
            </div>
          </Alert>
        ) : result?.success === false ? (
          <Alert variant="destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{result.message}</span>
            </div>
          </Alert>
        ) : null}

        <div className="flex gap-2">
          {statusTabs.map((tab) => {
            const isActive = tab.value === data.statusFilter;
            return (
              <Link
                key={tab.label}
                to="/admin/$orgSlug/leagues/$leagueSlug/match-flags"
                params={{ orgSlug, leagueSlug }}
                search={{ status: tab.value }}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {data.flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border py-12 text-center">
            <CheckCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No flags found</h3>
            <p className="text-sm text-muted-foreground">
              {data.statusFilter === 'all'
                ? 'No match flags yet'
                : `No ${data.statusFilter.toLowerCase()} flags`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.flags.map((flag) => {
              const match = data.matchesById[flag.matchId] ?? null;
              const isCurrentSeason =
                !!match &&
                data.currentSeasonId != null &&
                match.seasonId === data.currentSeasonId;
              const statusMeta = STATUS_META[flag.status];
              const StatusIcon = statusMeta.icon;

              return (
                <Card
                  key={flag.id}
                  data-testid="match-flag-card"
                  data-flag-id={flag.id}
                >
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusMeta.class}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusMeta.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Flagged by {flag.flaggedByDisplayName ?? 'Unknown'} on{' '}
                          {formatDate(flag.createdAt, '—', dateOpts)}
                        </span>
                      </div>
                    </div>

                    {flag.status === 'Open' && (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hydrated || !isCurrentSeason}
                          data-testid="match-flag-edit"
                          onClick={() => {
                            if (match) {
                              setEditing(match);
                              setEditDialogOpen(true);
                            }
                          }}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit match
                        </Button>
                        <form
                          method="post"
                          action={`/admin/${orgSlug}/leagues/${leagueSlug}/match-flags`}
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (
                              !window.confirm(
                                'Replay every match from this one to the end of the season?'
                              )
                            )
                              return;
                            void run(
                              recalculateMatchesFn({
                                data: {
                                  orgSlug,
                                  leagueSlug,
                                  fromMatchId: flag.matchId,
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
                            value={flag.matchId}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={!isCurrentSeason}
                            data-testid="match-flag-recalculate"
                          >
                            <RefreshCw className="mr-1 h-3.5 w-3.5" />
                            Recalc
                          </Button>
                        </form>
                        <Button
                          size="sm"
                          disabled={!hydrated}
                          data-testid="match-flag-resolve"
                          onClick={() => handleResolve(flag.id)}
                        >
                          <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          Resolve
                        </Button>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {match ? (
                      <MatchCard match={match} showMmr />
                    ) : (
                      <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        This match no longer exists — it may have been deleted.
                      </div>
                    )}

                    {flag.status === 'Open' && match && !isCurrentSeason && (
                      <p className="text-xs text-muted-foreground">
                        This match is in a past season, so it can&apos;t be
                        edited or recalculated — resolve or dismiss the flag
                        instead.
                      </p>
                    )}

                    <div className="space-y-1 rounded-md border border-border p-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Reason
                      </span>
                      <p className="whitespace-pre-wrap text-sm">
                        {flag.reason}
                      </p>
                    </div>

                    {flag.status !== 'Open' && (
                      <div className="text-sm text-muted-foreground">
                        <span>
                          {`${flag.status === 'Resolved' ? 'Resolved' : 'Dismissed'}${
                            flag.resolvedByDisplayName
                              ? ` by ${flag.resolvedByDisplayName}`
                              : ''
                          }${
                            flag.resolvedAt
                              ? ` on ${formatDate(flag.resolvedAt, '—', dateOpts)}`
                              : ''
                          }`}
                        </span>
                        {flag.resolutionNote && (
                          <p className="mt-1 italic">“{flag.resolutionNote}”</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Match Flag</DialogTitle>
            <DialogDescription>
              Mark this flag as resolved or dismissed with an optional note.
            </DialogDescription>
          </DialogHeader>

          {selectedFlag && (
            <div className="space-y-4 py-4">
              {selectedMatch && <MatchCard match={selectedMatch} />}

              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Flagged by:
                  </span>
                  <span className="text-sm">
                    {selectedFlag.flaggedByDisplayName ?? 'Unknown'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Reason:
                  </span>
                  <p className="text-sm">{selectedFlag.reason}</p>
                </div>
              </div>

              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const actionResult = await run(
                    resolveFlagFn({
                      data: {
                        orgId: data.orgId,
                        leagueId: data.leagueId,
                        flagId: selectedFlag.id,
                        status: resolveStatus,
                        note: resolutionNote,
                      },
                    })
                  );
                  if (actionResult.success) closeResolveDialog();
                }}
              >
                <input type="hidden" name="flagId" value={selectedFlag.id} />
                <input type="hidden" name="status" value={resolveStatus} />
                <input type="hidden" name="orgId" value={data.orgId} />
                <input type="hidden" name="leagueId" value={data.leagueId} />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Resolution</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          resolveStatus === 'Resolved' ? 'default' : 'outline'
                        }
                        onClick={() => setResolveStatus('Resolved')}
                      >
                        <CheckCircle className="mr-1 h-3.5 w-3.5" />
                        Resolve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          resolveStatus === 'Dismissed' ? 'default' : 'outline'
                        }
                        onClick={() => setResolveStatus('Dismissed')}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Resolution Note (Optional)</Label>
                    <textarea
                      id="note"
                      name="note"
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Add a note about why this flag was resolved..."
                      value={resolutionNote}
                      onChange={(event) =>
                        setResolutionNote(event.target.value)
                      }
                    />
                  </div>
                </div>

                <DialogFooter className="mt-4 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeResolveDialog}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {resolveStatus === 'Resolved' ? 'Resolve' : 'Dismiss'} Flag
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditMatchDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        match={editing}
        leaguePlayers={data.players}
        onSave={({ matchId, teams }) =>
          run(editMatchFn({ data: { orgSlug, leagueSlug, matchId, teams } }))
        }
      />
    </>
  );
}
