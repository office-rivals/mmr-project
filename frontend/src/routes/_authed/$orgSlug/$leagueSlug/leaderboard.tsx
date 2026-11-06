import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AppLink } from '@/components/app-link';
import { Eyebrow } from '@/components/eyebrow';
import { HttpErrorView } from '@/components/http-error-view';
import {
  Podium,
  StandingsTable,
  StreaksCard,
  UnrankedList,
  YourPositionCard,
  type StandingsMetric,
} from '@/components/leaderboard/standings';
import { PageTitle } from '@/components/page-title';
import { SeasonPicker } from '@/components/season-picker';
import { getLeagueRatingHistoryFn, getStandingsFn } from '@/lib/league-data';
import {
  WEEK_MS,
  changeSince,
  formByPlayer,
  formWins,
  winRate,
} from '@/lib/player-stats';
import { cn, formatLeagueFormat } from '@/lib/utils';
import type { LeagueRatingHistoryEntry, SeasonResponse } from '@/api-v3';

type SortKey = StandingsMetric;

const SORTS: readonly (readonly [SortKey, string])[] = [
  ['mmr', 'MMR'],
  ['winrate', 'Win rate'],
  ['form', 'Form'],
  ['week', 'This week'],
];

interface StandingsSearch {
  season?: string;
  sort?: SortKey;
}

export const Route = createFileRoute(
  '/_authed/$orgSlug/$leagueSlug/leaderboard'
)({
  validateSearch: (search: Record<string, unknown>): StandingsSearch => ({
    ...(typeof search.season === 'string' && search.season
      ? { season: search.season }
      : {}),
    ...(search.sort === 'winrate' ||
    search.sort === 'form' ||
    search.sort === 'week'
      ? { sort: search.sort }
      : {}),
  }),
  loaderDeps: ({ search }) => ({ season: search.season }),
  loader: async ({ context, deps }) => {
    const { orgId, leagueId } = context.league;
    const standings = await getStandingsFn({
      data: { orgId, leagueId, season: deps.season },
    });
    // Streamed: sparklines fill in after the table paints.
    const ratingHistoryPromise = getLeagueRatingHistoryFn({
      data: { orgId, leagueId, seasonId: standings.seasonId },
    }).catch(() => ({ entries: [] as LeagueRatingHistoryEntry[] }));
    return { ...standings, ratingHistoryPromise, league: context.league };
  },
  staticData: { wide: true },
  errorComponent: HttpErrorView,
  component: StandingsPage,
});

function StandingsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { league } = data;
  const base = `/${league.orgSlug}/${league.leagueSlug}`;
  const playerHref = (id: string) => `${base}/player/${id}`;
  const me = league.leaguePlayerId;
  // The week only exists for the season in progress.
  const sort: SortKey =
    search.sort === 'week' && !data.isCurrentSeason
      ? 'mmr'
      : (search.sort ?? 'mmr');

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

  const entries = data.leaderboard.entries ?? [];
  const ranked = entries.filter((e) => e.mmr != null);
  const unranked = entries.filter((e) => e.mmr == null);
  const myEntry = ranked.find((e) => e.leaguePlayerId === me);
  const form = useMemo(
    () => formByPlayer(data.recentMatches),
    [data.recentMatches]
  );
  const week = useMemo(
    () => changeSince(data.recentMatches, data.now - WEEK_MS),
    [data.recentMatches, data.now]
  );
  // Each alternative sort falls back to the MMR order for ties.
  const sorted = [...ranked];
  if (sort === 'winrate') {
    sorted.sort((a, b) => winRate(b) - winRate(a) || b.wins - a.wins);
  } else if (sort === 'form') {
    sorted.sort(
      (a, b) =>
        formWins(form.get(b.leaguePlayerId)) -
        formWins(form.get(a.leaguePlayerId))
    );
  } else if (sort === 'week') {
    const key = (id: string) => {
      const change = week.get(id);
      return change?.games ? (change.delta ?? 0) : -Infinity;
    };
    sorted.sort((a, b) => key(b.leaguePlayerId) - key(a.leaguePlayerId));
  }

  const seasonIndex = data.seasons.findIndex((s) => s.id === data.seasonId);
  const eyebrow = [
    seasonIndex >= 0 ? `Season ${data.seasons.length - seasonIndex}` : null,
    formatLeagueFormat(league.leagueTeamSize),
    `${ranked.length} ranked`,
    unranked.length ? `${unranked.length} unranked` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleSeasonChange = (season: SeasonResponse) => {
    void navigate({
      search: (prev: StandingsSearch) => ({
        ...prev,
        season: season.id === data.currentSeason?.id ? undefined : season.id,
      }),
      replace: true,
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>{eyebrow}</Eyebrow>
          <PageTitle>Leaderboard</PageTitle>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div
            role="group"
            aria-label="Sort by"
            className="flex flex-1 rounded-full border bg-card p-1 sm:flex-none"
          >
            {SORTS.filter(
              ([key]) => key !== 'week' || data.isCurrentSeason
            ).map(([key, label]) => (
              <AppLink
                key={key}
                to="."
                search={{
                  ...search,
                  sort: key === 'mmr' ? undefined : key,
                }}
                replace
                aria-current={sort === key ? 'true' : undefined}
                className={cn(
                  'flex min-h-11 flex-1 items-center justify-center rounded-full px-2.5 py-1.5 text-center text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-4 lg:min-h-0',
                  sort === key && 'bg-muted font-semibold text-foreground'
                )}
              >
                {label}
              </AppLink>
            ))}
          </div>
          {data.seasons.length > 1 && data.currentSeason ? (
            <SeasonPicker
              seasons={data.seasons}
              currentSeason={data.currentSeason}
              selectedSeasonId={search.season}
              onSeasonChange={handleSeasonChange}
            />
          ) : null}
        </div>
      </div>

      {ranked.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
          Nobody has placed yet this season.
        </p>
      ) : (
        <Podium top={ranked.slice(0, 3)} me={me} playerHref={playerHref} />
      )}

      {/* The side rail waits for xl: at lg it would squeeze the table. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="flex flex-col gap-6">
          {myEntry ? (
            <div className="xl:hidden">
              <YourPositionCard ranked={ranked} me={myEntry} />
            </div>
          ) : null}
          {ranked.length > 0 && (sort === 'form' || sort === 'week') ? (
            <p className="-mb-3 text-xs text-muted-foreground">
              {sort === 'form'
                ? "Sorted by wins in each player's last 5 matches."
                : data.weekComplete
                  ? 'Sorted by rating change over the last 7 days.'
                  : `Sorted by rating change over the last 7 days, counting the latest ${data.recentMatches.length} matches.`}
            </p>
          ) : null}
          {ranked.length > 0 ? (
            <StandingsTable
              key={sort}
              entries={sorted}
              me={me}
              form={form}
              ratingHistory={ratingHistory}
              playerHref={playerHref}
              metric={sort}
              week={week}
              podium={sort === 'mmr' && ranked.length >= 3}
            />
          ) : null}
          <UnrankedList entries={unranked} playerHref={playerHref} />
        </div>
        <aside className="hidden flex-col gap-6 xl:flex">
          {myEntry ? <YourPositionCard ranked={ranked} me={myEntry} /> : null}
          <StreaksCard entries={ranked} me={me} />
        </aside>
      </div>
    </div>
  );
}
