import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Check, ChevronRight, Flag } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Eyebrow } from '@/components/eyebrow';
import {
  HomeHeroCompact,
  HomeKpiTiles,
  HomeRankCard,
  LeagueStandingCard,
  LiveNowCard,
  PartnerCards,
  RatingCard,
  type HomeStanding,
} from '@/components/home/home-overview';
import { FlagResultAlert } from '@/components/flag-result-alert';
import { HttpErrorView } from '@/components/http-error-view';
import { Leaderboard } from '@/components/leaderboard';
import { MatchCard } from '@/components/match-card';
import { PageTitle } from '@/components/page-title';
import { ReportMatchModal } from '@/components/report-match-modal';
import { SeasonPicker } from '@/components/season-picker';
import { UserStatsModal } from '@/components/user-stats-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useHydrated } from '@/hooks/use-hydrated';
import { useMatchFlagHandlers } from '@/hooks/use-match-flag-handlers';
import { useShowMmr } from '@/hooks/use-show-mmr';
import { HttpError } from '@/lib/http-error';
import {
  WEEK_MS,
  bestDuoAndNemesis,
  matchesSince,
  peakRating,
  ratingChangeSince,
  recentForm,
} from '@/lib/player-stats';
import { getLeagueRatingHistoryFn } from '@/lib/league-data';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { cn, formatLeagueFormat } from '@/lib/utils';
import { selectCurrentSeason } from '@/lib/util/season';
import type {
  ActiveMatchResponse,
  LeaderboardEntryResponse,
  LeaderboardResponse,
  LeagueRatingHistoryEntry,
  MatchFlagResponse,
  MatchResponse,
  SeasonResponse,
} from '@/api-v3';

interface LeagueHomeSearch {
  season?: string;
}

interface LeagueHomeData {
  leaderboard: LeaderboardResponse;
  recentMatches: MatchResponse[];
  seasons: SeasonResponse[];
  currentSeason: SeasonResponse | null;
  /** No `?season=`, or it names the current season. Gates the report flow. */
  isCurrentSeason: boolean;
  /**
   * `?season=` when present, otherwise the current season resolved from the
   * seasons list. Every season-scoped call on this page must use this, not the
   * raw search param — the default view is the *current season*, not all-time.
   */
  seasonId: string | undefined;
  myFlags: MatchFlagResponse[];
  /** The viewer's matches this season, newest first, for the overview. */
  myMatches: MatchResponse[];
  activeMatches: ActiveMatchResponse[];
  /**
   * Server-pinned clock shipped with the payload so the match-feed date
   * buckets are identical during SSR and hydration. A page served at 23:59:59
   * must not relabel itself when the client hydrates at 00:00:01 — never
   * substitute a client-side `Date.now()` in the grouping call.
   */
  now: number;
}

const getLeagueHomeFn = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      orgId: string;
      leagueId: string;
      leaguePlayerId: string | null;
      season?: string;
    }) => input
  )
  .handler(async ({ data }): Promise<LeagueHomeData> => {
    const apiClientV3 = await requireApiClientV3();

    try {
      const seasons = await apiClientV3.seasonsApi.listSeasons(
        data.orgId,
        data.leagueId
      );
      const currentSeason = selectCurrentSeason(seasons);
      // `undefined` when the league has no seasons at all — the API then reads
      // it as "all-time / league-level".
      const seasonId = data.season ?? currentSeason?.id;
      const isCurrentSeason =
        currentSeason != null &&
        (data.season == null || data.season === currentSeason.id);

      const [leaderboard, recentMatches, myFlags, myMatches, activeMatches] =
        await Promise.all([
          apiClientV3.leaderboardApi.getLeaderboard(
            data.orgId,
            data.leagueId,
            seasonId
          ),
          apiClientV3.matchesApi.getMatches(data.orgId, data.leagueId, {
            seasonId,
            limit: 5,
            offset: 0,
          }),
          // Individually caught: a flag-service blip degrades to "no flags", it
          // does not error the page.
          apiClientV3.matchFlagsApi
            .getMyFlags(data.orgId, data.leagueId)
            .catch((): MatchFlagResponse[] => []),
          // The overview cards are extras: their failures degrade to empty.
          data.leaguePlayerId
            ? apiClientV3.matchesApi
                .getMatches(data.orgId, data.leagueId, {
                  seasonId,
                  leaguePlayerId: data.leaguePlayerId,
                  limit: 200,
                  offset: 0,
                })
                .catch((): MatchResponse[] => [])
            : Promise.resolve([] as MatchResponse[]),
          apiClientV3.activeMatchesApi
            .listActiveMatches(data.orgId, data.leagueId)
            .catch((): ActiveMatchResponse[] => []),
        ]);

      return {
        leaderboard,
        recentMatches,
        seasons,
        currentSeason,
        isCurrentSeason,
        seasonId,
        myFlags,
        myMatches,
        activeMatches,
        now: Date.now(),
      };
    } catch {
      throw new HttpError(500, 'Failed to load leaderboard');
    }
  });

export const Route = createFileRoute('/_authed/$orgSlug/$leagueSlug/')({
  // Permissive on purpose: the Svelte page forwarded whatever `?season=` held
  // straight to the API. A stricter uuid check would turn a bad link into a
  // client-side validation error instead of the API's own answer.
  validateSearch: (search: Record<string, unknown>): LeagueHomeSearch => {
    const season = search.season;
    return typeof season === 'string' && season.length > 0 ? { season } : {};
  },
  // Makes `?season=` part of the loader identity, so switching seasons is a
  // full data refresh rather than client-side filtering.
  loaderDeps: ({ search }) => ({ season: search.season }),
  loader: async ({ context, deps, params }) => {
    const { orgId, leagueId, leaguePlayerId } = context.league;

    const home = await getLeagueHomeFn({
      data: { orgId, leagueId, leaguePlayerId, season: deps.season },
    });

    // Awaited never: the promise is streamed to the client, so the leaderboard
    // paints with placeholder sparklines. It has to run after the home fn only
    // because it needs that fn's *resolved* season (`?season=` ?? current
    // season) — passing the raw search param would draw all-time sparklines on
    // the default view.
    const ratingHistoryPromise = getLeagueRatingHistoryFn({
      data: { orgId, leagueId, seasonId: home.seasonId },
    }).catch(() => ({ entries: [] as LeagueRatingHistoryEntry[] }));

    return {
      ...home,
      ratingHistoryPromise,
      orgId,
      leagueId,
      leaguePlayerId,
      leagueTeamSize: context.league.leagueTeamSize,
      displayName:
        context.authedShell.displayName ?? context.authedShell.username,
      orgSlug: params.orgSlug,
      leagueSlug: params.leagueSlug,
    };
  },
  staticData: { wide: true },
  errorComponent: HttpErrorView,
  component: LeagueHomeRoute,
});

function LeagueHomeRoute() {
  const { leagueId } = Route.useLoaderData();
  return <LeagueHomePage key={leagueId} />;
}

function LeagueHomePage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // The report trigger and the MMR toggle do nothing at all until React has
  // attached their handlers: the modal is client-only and the toggle writes to
  // localStorage. The SSR'd markup paints (and is clickable) well before
  // hydration finishes, and a click landing in that window is dropped, not
  // replayed — so keep both disabled until the page is actually interactive.
  const hydrated = useHydrated();
  const [showMmr, setShowMmr] = useShowMmr();

  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] =
    useState<LeaderboardEntryResponse | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  // `undefined` => still streaming => sparkline placeholders. Never reset to
  // `undefined` on navigation, so the previous season's line can linger for a
  // moment after a season switch — same as the Svelte original.
  const [ratingHistory, setRatingHistory] = useState<
    LeagueRatingHistoryEntry[] | undefined
  >(undefined);

  const { ratingHistoryPromise } = data;
  useEffect(() => {
    let cancelled = false;
    void ratingHistoryPromise.then((res) => {
      if (!cancelled) setRatingHistory(res.entries);
    });
    return () => {
      cancelled = true;
    };
  }, [ratingHistoryPromise]);

  const fetchRecentMatch = useCallback(
    async (
      leaguePlayerId: string,
      seasonId: string | undefined
    ): Promise<MatchResponse | null> => {
      const params = new URLSearchParams({ leaguePlayerId });
      if (seasonId) params.set('season', seasonId);
      const res = await fetch(
        `/${data.orgSlug}/${data.leagueSlug}/api/recent-match?${params}`
      );
      if (!res.ok) throw new Error('Failed to fetch recent match');
      const body = (await res.json()) as { match: MatchResponse | null };
      return body.match;
    },
    [data.orgSlug, data.leagueSlug]
  );

  const {
    result: formResult,
    setResult: setFormResult,
    onCreateFlag: handleCreateFlag,
    onUpdateFlag: handleUpdateFlag,
    onDeleteFlag: handleDeleteFlag,
  } = useMatchFlagHandlers(data.orgId, data.leagueId);

  const handleSeasonChange = (season: SeasonResponse) => {
    const isCurrent = season.id === data.currentSeason?.id;
    // SvelteKit drops `form` on every navigation; the component does not
    // unmount across a search-param change, so clear the banner by hand.
    setFormResult(null);
    void navigate({
      search: (prev: LeagueHomeSearch) => ({
        ...prev,
        season: isCurrent ? undefined : season.id,
      }),
      replace: true,
    });
  };

  const canReport = Boolean(data.leaguePlayerId && data.isCurrentSeason);
  const base = `/${data.orgSlug}/${data.leagueSlug}`;
  const entries = data.leaderboard?.entries ?? [];
  const ranked = entries.filter((e) => e.mmr != null);
  const myEntry = data.leaguePlayerId
    ? (entries.find((e) => e.leaguePlayerId === data.leaguePlayerId) ?? null)
    : null;
  const myHistory = useMemo(
    () =>
      ratingHistory && data.leaguePlayerId
        ? ratingHistory
            .filter((h) => h.leaguePlayerId === data.leaguePlayerId)
            .sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt))
        : undefined,
    [ratingHistory, data.leaguePlayerId]
  );
  const partners = useMemo(
    () =>
      data.leaguePlayerId
        ? bestDuoAndNemesis(data.myMatches, data.leaguePlayerId)
        : { duo: null, nemesis: null },
    [data.myMatches, data.leaguePlayerId]
  );
  const weekStart = data.now - WEEK_MS;
  const standing: HomeStanding | null = myEntry
    ? {
        entry: myEntry,
        ranked,
        form: recentForm(data.myMatches, myEntry.leaguePlayerId),
        // "This week" means nothing for a past season.
        weekDelta: !data.isCurrentSeason
          ? null
          : myHistory && ratingChangeSince(myHistory, weekStart),
      }
    : null;
  const liveMatch = data.isCurrentSeason ? data.activeMatches[0] : undefined;
  const partnerCardCount = [partners.duo, partners.nemesis, liveMatch].filter(
    Boolean
  ).length;

  const selectedSeasonId = search.season ?? data.currentSeason?.id;
  const seasonIndex = data.seasons.findIndex((s) => s.id === selectedSeasonId);
  const eyebrow = [
    seasonIndex >= 0 ? `Season ${data.seasons.length - seasonIndex}` : null,
    formatLeagueFormat(data.leagueTeamSize),
  ]
    .filter(Boolean)
    .join(' · ');
  const firstName = data.displayName?.trim().split(/\s+/)[0];

  return (
    <>
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageTitle srOnly>Leaderboard</PageTitle>

        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Eyebrow>{eyebrow}</Eyebrow>
            <p className="truncate text-3xl font-bold tracking-tight lg:text-4xl">
              {firstName ? `Hey ${firstName}` : 'Welcome back'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {canReport ? (
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                disabled={!hydrated}
                onClick={() => setReportModalOpen(true)}
              >
                <Flag className="mr-1.5 h-4 w-4" />
                Report match
              </Button>
            ) : null}
            {data.seasons != null &&
            data.seasons.length > 1 &&
            data.currentSeason ? (
              <SeasonPicker
                seasons={data.seasons}
                currentSeason={data.currentSeason}
                selectedSeasonId={search.season}
                onSeasonChange={handleSeasonChange}
              />
            ) : null}
          </div>
        </div>

        <FlagResultAlert result={formResult} />

        {standing ? (
          <>
            <HomeHeroCompact standing={standing} />
            <div className="hidden gap-4 lg:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <HomeRankCard standing={standing} />
              <HomeKpiTiles
                standing={standing}
                matchesThisWeek={
                  data.isCurrentSeason
                    ? matchesSince(data.myMatches, weekStart)
                    : null
                }
                peak={myHistory && peakRating(myHistory)}
              />
            </div>
            <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <RatingCard points={myHistory} />
              <LeagueStandingCard standing={standing} />
            </div>
          </>
        ) : null}

        {partnerCardCount > 0 ? (
          <div
            className={cn(
              'hidden gap-4 lg:grid',
              partnerCardCount === 1
                ? 'lg:grid-cols-1'
                : partnerCardCount === 2
                  ? 'lg:grid-cols-2'
                  : 'lg:grid-cols-3'
            )}
          >
            <PartnerCards
              duo={partners.duo}
              nemesis={partners.nemesis}
              profileBase={`${base}/player`}
            />
            {liveMatch ? (
              <LiveNowCard
                match={liveMatch}
                now={data.now}
                href={`${base}/matchmaking`}
              />
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
          <section
            aria-labelledby="home-matches-heading"
            className="flex flex-col gap-3 xl:col-start-2 xl:row-start-1"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="home-matches-heading" className="text-2xl">
                Recent Matches
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label
                    id="show-mmr-label"
                    htmlFor="show-mmr"
                    className="text-xs tracking-[0.14em] text-muted-foreground uppercase"
                  >
                    MMR:
                  </Label>
                  {/* Hand-rolled because the library ships no Checkbox: e2e
                      clicks `button[role=checkbox]#show-mmr` exactly. */}
                  <button
                    type="button"
                    id="show-mmr"
                    role="checkbox"
                    aria-checked={showMmr}
                    aria-labelledby="show-mmr-label"
                    data-state={showMmr ? 'checked' : 'unchecked'}
                    disabled={!hydrated}
                    onClick={() => setShowMmr(!showMmr)}
                    className="inline-flex size-5 items-center justify-center rounded border border-muted-foreground/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                  >
                    {showMmr ? (
                      <Check className="size-3.5 text-primary-foreground" />
                    ) : null}
                  </button>
                </div>
                <ViewAll to={`${base}/matches`} label="matches" />
              </div>
            </div>
            {/* Cards are direct children: the e2e selector
                `.flex.flex-1.flex-col.items-stretch > div.bg-card` resolves
                to a card. There is no empty state. */}
            <div className="flex flex-1 flex-col items-stretch gap-2">
              {(data.recentMatches ?? []).map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  showMmr={showMmr}
                  now={data.now}
                  viewerId={data.leaguePlayerId}
                />
              ))}
            </div>
          </section>

          <section
            aria-labelledby="home-leaderboard-heading"
            className="flex flex-col gap-3 xl:col-start-1 xl:row-start-1"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="home-leaderboard-heading" className="text-2xl">
                Leaderboard
              </h2>
              <ViewAll to={`${base}/leaderboard`} label="standings" />
            </div>
            <Leaderboard
              entries={entries}
              ratingHistory={ratingHistory}
              onSelect={(entry) => {
                setSelectedEntry(entry);
                setStatsModalOpen(true);
              }}
              currentLeaguePlayerId={data.leaguePlayerId}
            />
          </section>
        </div>
      </div>

      {/* Stays mounted after close — `selectedEntry` is never cleared, so the
          dialog animates out with the last entry's data. */}
      {selectedEntry ? (
        <UserStatsModal
          entry={selectedEntry}
          open={statsModalOpen}
          onOpenChange={setStatsModalOpen}
          fetchRecentMatch={fetchRecentMatch}
          playerHrefBase={`/${data.orgSlug}/${data.leagueSlug}/player`}
          seasonId={search.season}
        />
      ) : null}

      {/* Double-gated: league membership AND the current season. */}
      {canReport && data.leaguePlayerId ? (
        <ReportMatchModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          orgId={data.orgId}
          leagueId={data.leagueId}
          seasonId={data.currentSeason?.id}
          leaguePlayerId={data.leaguePlayerId}
          userFlags={data.myFlags ?? []}
          onCreateFlag={handleCreateFlag}
          onUpdateFlag={handleUpdateFlag}
          onDeleteFlag={handleDeleteFlag}
        />
      ) : null}
    </>
  );
}

function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <AppLink
      to={to}
      className="inline-flex items-center gap-0.5 rounded-sm text-sm text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      View all<span className="sr-only"> {label}</span>
      <ChevronRight aria-hidden="true" className="size-4" />
    </AppLink>
  );
}
