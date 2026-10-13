import { Fragment, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Flag, LoaderCircle } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Eyebrow } from '@/components/eyebrow';
import { FlagResultAlert } from '@/components/flag-result-alert';
import { HttpErrorView } from '@/components/http-error-view';
import {
  MatchCard,
  MatchDateHeader,
  MatchFlagButton,
} from '@/components/match-card';
import {
  BiggestSwings,
  WeekSummaryCard,
  WeekSummaryCompact,
} from '@/components/matches/match-summary';
import { PageTitle } from '@/components/page-title';
import { FlagDialogs } from '@/components/profile/flag-dialogs';
import { ReportMatchModal } from '@/components/report-match-modal';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { useMatchFlagHandlers } from '@/hooks/use-match-flag-handlers';
import { useShowMmr } from '@/hooks/use-show-mmr';
import { getMatchFeedFn, getMatchesPageFn } from '@/lib/league-data';
import { cn } from '@/lib/utils';
import type { FlagActionResult } from '@/lib/match-flag-actions';
import type { MatchFlagResponse, MatchResponse } from '@/api-v3';

interface MatchesSearch {
  season?: string;
  view?: 'everyone';
}

export const Route = createFileRoute('/_authed/$orgSlug/$leagueSlug/matches')({
  validateSearch: (search: Record<string, unknown>): MatchesSearch => ({
    ...(typeof search.season === 'string' && search.season
      ? { season: search.season }
      : {}),
    ...(search.view === 'everyone' ? { view: 'everyone' as const } : {}),
  }),
  loaderDeps: ({ search }) => ({ season: search.season, view: search.view }),
  loader: async ({ context, deps }) => {
    const { orgId, leagueId, leaguePlayerId } = context.league;
    const page = await getMatchesPageFn({
      data: {
        orgId,
        leagueId,
        leaguePlayerId,
        season: deps.season,
        mine: deps.view !== 'everyone',
      },
    });
    return { ...page, league: context.league };
  },
  staticData: { wide: true },
  errorComponent: HttpErrorView,
  component: MatchesRoute,
});

function MatchesRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  // A new filter or season starts a fresh feed rather than appending to it.
  return (
    <MatchesPage
      key={`${data.league.leagueId}:${data.seasonId}:${search.view ?? 'mine'}`}
    />
  );
}

function MatchesPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const hydrated = useHydrated();
  const [showMmr, setShowMmr] = useShowMmr();
  const { formatMatchDay, formatDate } = useLocaleFormatters();
  const { league } = data;
  const base = `/${league.orgSlug}/${league.leagueSlug}`;
  const me = league.leaguePlayerId;
  const mine = me != null && search.view !== 'everyone';
  const canReport = Boolean(me && data.isCurrentSeason);
  const [reportOpen, setReportOpen] = useState(false);
  const flags = useMatchFlagHandlers(league.orgId, league.leagueId);
  const flagFor = (matchId: string) =>
    data.myFlags.find((f) => f.matchId === matchId);
  const [flagging, setFlagging] = useState<{
    matchId: string;
    flag: MatchFlagResponse | undefined;
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Success refreshes the loaders and shows the page banner; a failure is
  // shown in the same banner, since the reason dialog has no error slot.
  const settleFlag = async (pending: Promise<FlagActionResult>) => {
    const result = await pending.catch((): FlagActionResult => ({
      success: false,
      message: 'Failed to save the flag',
    }));
    if (!result.success) flags.setResult(result);
    else {
      setDeleteConfirmOpen(false);
      setFlagging(null);
    }
  };

  const [older, setOlder] = useState<MatchResponse[]>([]);
  const [hasMore, setHasMore] = useState(data.feed.hasMore);
  const loadOlder = useMutation({
    mutationFn: () =>
      getMatchFeedFn({
        data: {
          orgId: league.orgId,
          leagueId: league.leagueId,
          seasonId: data.seasonId,
          leaguePlayerId: mine ? me! : undefined,
          offset: data.feed.matches.length + older.length,
        },
      }),
    onSuccess: (page) => {
      setOlder((prev) => [...prev, ...page.matches]);
      setHasMore(page.hasMore);
    },
  });

  const matches = [...data.feed.matches, ...older];
  const groups: { label: string; matches: MatchResponse[] }[] = [];
  for (const match of matches) {
    const date = formatDate(match.playedAt, '', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const day = formatMatchDay(match.playedAt, data.now);
    const label = day === date ? date : `${day} · ${date}`;
    const last = groups[groups.length - 1];
    if (last?.label === label) last.matches.push(match);
    else groups.push({ label, matches: [match] });
  }

  const seasonIndex = data.seasons.findIndex((s) => s.id === data.seasonId);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            {seasonIndex >= 0 ? (
              <Eyebrow>Season {data.seasons.length - seasonIndex}</Eyebrow>
            ) : null}
            <PageTitle>Matches</PageTitle>
          </div>
          {canReport ? (
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              disabled={!hydrated}
              onClick={() => setReportOpen(true)}
            >
              <Flag className="mr-1.5 h-4 w-4" />
              Report match
            </Button>
          ) : null}
        </div>

        <FlagResultAlert result={flags.result} />

        <div className="flex flex-wrap items-center justify-between gap-3 lg:rounded-lg lg:border lg:bg-card lg:p-2 lg:pr-4">
          {me ? (
            <div
              role="group"
              aria-label="Whose matches"
              className="flex flex-1 rounded-full border bg-card p-1 sm:flex-none"
            >
              {(
                [
                  [undefined, 'Mine'],
                  ['everyone', 'Everyone'],
                ] as const
              ).map(([view, label]) => {
                const active = (search.view ?? undefined) === view;
                return (
                  <AppLink
                    key={label}
                    to="."
                    search={{ ...search, view }}
                    replace
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex-1 rounded-full px-5 py-1.5 text-center text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      active && 'bg-muted font-semibold text-foreground'
                    )}
                  >
                    {label}
                  </AppLink>
                );
              })}
            </div>
          ) : (
            <span />
          )}
          <label className="flex items-center gap-3 text-sm">
            MMR changes
            <button
              type="button"
              role="switch"
              aria-checked={showMmr}
              disabled={!hydrated}
              onClick={() => setShowMmr(!showMmr)}
              className={cn(
                'relative h-6 w-11 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                showMmr ? 'border-primary bg-primary' : 'bg-muted'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-0.5 size-[18px] rounded-full bg-foreground transition-[left] motion-reduce:transition-none',
                  showMmr ? 'left-[22px]' : 'left-0.5'
                )}
              />
            </button>
          </label>
        </div>

        {me && data.isCurrentSeason ? (
          <WeekSummaryCompact
            matches={data.myMatches}
            me={me}
            now={data.now}
            showMmr={showMmr}
          />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section aria-label="Match feed" className="flex flex-col gap-2">
            {groups.length === 0 ? (
              <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
                {mine
                  ? 'You have not played a match this season.'
                  : 'No matches this season.'}
              </p>
            ) : null}
            {groups.map((group) => (
              <Fragment key={group.label}>
                <MatchDateHeader label={group.label} />
                {group.matches.map((match) => {
                  const flag = flagFor(match.id);
                  return (
                    <div
                      key={match.id}
                      className={cn(
                        'flex items-stretch gap-1 rounded-lg',
                        flag && 'ring-1 ring-red-400'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <MatchCard
                          match={match}
                          showMmr={showMmr}
                          viewerId={me}
                          renderPlayerLink={(player, name) => (
                            <AppLink
                              to={`${base}/player/${player.leaguePlayerId}`}
                              className="hover:underline"
                            >
                              {name}
                            </AppLink>
                          )}
                        />
                      </div>
                      {me ? (
                        <MatchFlagButton
                          flagged={flag != null}
                          disabled={!hydrated}
                          onClick={() => {
                            flags.setResult(null);
                            setFlagging({ matchId: match.id, flag });
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </Fragment>
            ))}
            {loadOlder.isError ? (
              <Alert variant="destructive">Failed to load older matches</Alert>
            ) : null}
            {hasMore ? (
              <Button
                variant="outline"
                className="mt-2 h-12"
                disabled={!hydrated || loadOlder.isPending}
                onClick={() => loadOlder.mutate()}
              >
                {loadOlder.isPending ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : null}
                Load older matches
              </Button>
            ) : null}
          </section>
          {me ? (
            <aside className="hidden flex-col gap-6 lg:flex">
              {data.isCurrentSeason ? (
                <WeekSummaryCard
                  matches={data.myMatches}
                  me={me}
                  now={data.now}
                  showMmr={showMmr}
                />
              ) : null}
              {showMmr ? (
                <BiggestSwings
                  matches={data.myMatches}
                  me={me}
                  now={data.now}
                />
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>

      <FlagDialogs
        open={flagging != null}
        editingFlagId={flagging?.flag?.id ?? null}
        initialReason={flagging?.flag?.reason ?? ''}
        onClose={() => setFlagging(null)}
        onSubmit={(reason) => {
          if (!flagging) return;
          void settleFlag(
            flagging.flag
              ? flags.onUpdateFlag({ flagId: flagging.flag.id, reason })
              : flags.onCreateFlag({ matchId: flagging.matchId, reason })
          );
        }}
        deleteConfirmOpen={deleteConfirmOpen}
        onDeleteConfirmChange={setDeleteConfirmOpen}
        onDelete={() => {
          if (flagging?.flag) {
            void settleFlag(flags.onDeleteFlag({ flagId: flagging.flag.id }));
          }
        }}
      />

      {canReport && me ? (
        <ReportMatchModal
          open={reportOpen}
          onOpenChange={setReportOpen}
          orgId={league.orgId}
          leagueId={league.leagueId}
          seasonId={data.currentSeason?.id}
          leaguePlayerId={me}
          userFlags={data.myFlags}
          onCreateFlag={flags.onCreateFlag}
          onUpdateFlag={flags.onUpdateFlag}
          onDeleteFlag={flags.onDeleteFlag}
        />
      ) : null}
    </>
  );
}
