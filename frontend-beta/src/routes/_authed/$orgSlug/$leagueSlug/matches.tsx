import { Fragment, useEffect, useState } from 'react';
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
import {
  PartnerFilters,
  type PartnerSelection,
} from '@/components/matches/partner-filters';
import { PageTitle } from '@/components/page-title';
import { FlagDialogs } from '@/components/profile/flag-dialogs';
import { ReportMatchModal } from '@/components/report-match-modal';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { useMatchFlagHandlers } from '@/hooks/use-match-flag-handlers';
import { useShowMmr } from '@/hooks/use-show-mmr';
import {
  MATCHES_PAGE_SIZE,
  getMatchFeedFn,
  getMatchesPageFn,
  type MatchFeedPage,
} from '@/lib/league-data';
import { partnerOptions, type PartnerOption } from '@/lib/player-stats';
import { cn } from '@/lib/utils';
import type { FlagActionResult } from '@/lib/match-flag-actions';
import type { MatchFlagResponse, MatchResponse } from '@/api-v3';

/** Rows loaded under `feed`, the page 1 they were paged from. */
interface OlderMatches extends MatchFeedPage {
  feed: MatchFeedPage;
}

interface MatchesSearch extends PartnerSelection {
  season?: string;
  view?: 'everyone';
}

const optionalId = (value: unknown) =>
  typeof value === 'string' && value ? value : undefined;

export const Route = createFileRoute('/_authed/$orgSlug/$leagueSlug/matches')({
  validateSearch: (search: Record<string, unknown>): MatchesSearch => ({
    ...(typeof search.season === 'string' && search.season
      ? { season: search.season }
      : {}),
    ...(search.view === 'everyone' ? { view: 'everyone' as const } : {}),
    ...(optionalId(search.with) ? { with: optionalId(search.with) } : {}),
    ...(optionalId(search.against)
      ? { against: optionalId(search.against) }
      : {}),
  }),
  loaderDeps: ({ search }) => ({
    season: search.season,
    view: search.view,
    with: search.with,
    against: search.against,
  }),
  loader: async ({ context, deps }) => {
    const { orgId, leagueId, leaguePlayerId } = context.league;
    const page = await getMatchesPageFn({
      data: {
        orgId,
        leagueId,
        leaguePlayerId,
        season: deps.season,
        mine: deps.view !== 'everyone',
        withId: deps.with,
        againstId: deps.against,
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
      key={[
        data.league.leagueId,
        data.seasonId,
        search.view ?? 'mine',
        search.with,
        search.against,
      ].join(':')}
    />
  );
}

function MatchesPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
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

  // Older rows are paged by offset under the loader's page 1. When the loader
  // refreshes (a flag action, pull to refresh) every row below page 1 can
  // shift, so the rows loaded so far are fetched again rather than kept.
  const [older, setOlder] = useState<OlderMatches>(() => ({
    feed: data.feed,
    matches: [],
    hasMore: data.feed.hasMore,
  }));
  const olderStale = older.feed !== data.feed;
  const loadedCount = older.matches.length;
  const feedScope = {
    orgId: league.orgId,
    leagueId: league.leagueId,
    seasonId: data.seasonId,
    leaguePlayerId: mine ? me! : undefined,
  };
  useEffect(() => {
    if (!olderStale) return;
    // Page 1 alone is exact, so it is also the fallback when the re-fetch fails.
    const pageOnly: OlderMatches = {
      feed: data.feed,
      matches: [],
      hasMore: data.feed.hasMore,
    };
    if (loadedCount === 0) {
      setOlder(pageOnly);
      return;
    }
    let cancelled = false;
    getMatchFeedFn({
      data: {
        orgId: feedScope.orgId,
        leagueId: feedScope.leagueId,
        seasonId: feedScope.seasonId,
        leaguePlayerId: feedScope.leaguePlayerId,
        offset: data.feed.matches.length,
        limit: loadedCount,
      },
    })
      .then((page): OlderMatches => ({ feed: data.feed, ...page }))
      .catch((): OlderMatches => pageOnly)
      .then((next) => {
        if (!cancelled) setOlder(next);
      });
    return () => {
      cancelled = true;
    };
  }, [
    olderStale,
    loadedCount,
    data.feed,
    feedScope.orgId,
    feedScope.leagueId,
    feedScope.seasonId,
    feedScope.leaguePlayerId,
  ]);
  const loadOlder = useMutation({
    mutationFn: (from: { feed: MatchFeedPage; offset: number }) =>
      getMatchFeedFn({ data: { ...feedScope, offset: from.offset } }),
    onSuccess: (page, from) =>
      setOlder((prev) =>
        prev.feed === from.feed
          ? {
              feed: prev.feed,
              matches: [...prev.matches, ...page.matches],
              hasMore: page.hasMore,
            }
          : prev
      ),
  });

  // A partner filter loads every match it finds, so paging is local.
  const [shown, setShown] = useState(MATCHES_PAGE_SIZE);
  const filtered = data.filtered != null;
  // Until the re-fetch lands, rows that moved up into page 1 are not repeated.
  const pageIds = olderStale
    ? new Set(data.feed.matches.map((m) => m.id))
    : null;
  const matches = filtered
    ? data.feed.matches.slice(0, shown)
    : [
        ...data.feed.matches,
        ...(pageIds
          ? older.matches.filter((m) => !pageIds.has(m.id))
          : older.matches),
      ];
  const olderPending = loadOlder.isPending || (olderStale && loadedCount > 0);
  const moreAvailable = filtered
    ? shown < data.feed.matches.length
    : older.hasMore;
  const partners = mine
    ? partnerOptions(data.myMatches, me)
    : { teammates: [], opponents: [] };
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
              className="h-11 lg:h-10"
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
                    search={{ season: search.season, view }}
                    replace
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex min-h-11 flex-1 items-center justify-center rounded-full px-5 py-1.5 text-center text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:min-h-0',
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
          {mine ? (
            <PartnerFilters
              teammates={withSelected(partners.teammates, search.with, matches)}
              opponents={withSelected(
                partners.opponents,
                search.against,
                matches
              )}
              value={{ with: search.with, against: search.against }}
              disabled={!hydrated}
              onChange={(next) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    with: next.with,
                    against: next.against,
                  }),
                  replace: true,
                })
              }
            />
          ) : null}
          <label className="flex min-h-11 items-center gap-3 text-sm lg:ml-auto lg:min-h-0">
            MMR changes
            <Switch
              checked={showMmr}
              onCheckedChange={setShowMmr}
              disabled={!hydrated}
            />
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
            {filtered && data.feed.matches.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {data.feed.matches.length}{' '}
                {data.feed.matches.length === 1 ? 'match' : 'matches'}
                {data.filtered?.truncated
                  ? ' among your latest this season'
                  : ' this season'}
              </p>
            ) : null}
            {groups.length === 0 ? (
              <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
                {filtered
                  ? 'No matches with these filters.'
                  : mine
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
                              // Stacked names cannot each get 44px without
                              // overlapping; this widens the target as far
                              // as it can go.
                              className="relative after:absolute after:-inset-x-1 after:-inset-y-[3px] hover:underline"
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
            {moreAvailable ? (
              <Button
                variant="outline"
                className="mt-2 h-12"
                disabled={!hydrated || olderPending}
                onClick={() =>
                  filtered
                    ? setShown((n) => n + MATCHES_PAGE_SIZE)
                    : loadOlder.mutate({
                        feed: data.feed,
                        offset: data.feed.matches.length + loadedCount,
                      })
                }
              >
                {olderPending ? (
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

/**
 * Keeps a filter that came in through the URL selectable even when that player
 * is outside the matches the options were built from.
 */
function withSelected(
  options: PartnerOption[],
  selected: string | undefined,
  matches: MatchResponse[]
): PartnerOption[] {
  if (!selected || options.some((o) => o.leaguePlayerId === selected)) {
    return options;
  }
  const player = matches
    .flatMap((m) => m.teams.flatMap((t) => t.players))
    .find((p) => p.leaguePlayerId === selected);
  return [
    {
      leaguePlayerId: selected,
      name: player?.username ?? player?.displayName ?? 'Unknown player',
      games: 0,
    },
    ...options,
  ];
}
