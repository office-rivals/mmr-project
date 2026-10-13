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
} from '@/components/leaderboard/standings';
import { PageTitle } from '@/components/page-title';
import { SeasonPicker } from '@/components/season-picker';
import { getLeagueRatingHistoryFn, getStandingsFn } from '@/lib/league-data';
import { formByPlayer, winRate } from '@/lib/player-stats';
import { cn, formatLeagueFormat } from '@/lib/utils';
import type { LeagueRatingHistoryEntry, SeasonResponse } from '@/api-v3';

type SortKey = 'mmr' | 'winrate';

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
    ...(search.sort === 'winrate' ? { sort: 'winrate' as const } : {}),
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
  const sort: SortKey = search.sort ?? 'mmr';

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
  const sorted =
    sort === 'winrate'
      ? [...ranked].sort((a, b) => winRate(b) - winRate(a) || b.wins - a.wins)
      : ranked;

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
            {(
              [
                ['mmr', 'MMR'],
                ['winrate', 'Win rate'],
              ] as const
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
                  'flex-1 rounded-full px-4 py-1.5 text-center text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-6">
          {myEntry ? (
            <div className="lg:hidden">
              <YourPositionCard ranked={ranked} me={myEntry} />
            </div>
          ) : null}
          {ranked.length > 0 ? (
            <StandingsTable
              key={sort}
              entries={sorted}
              me={me}
              form={form}
              ratingHistory={ratingHistory}
              playerHref={playerHref}
            />
          ) : null}
          <UnrankedList entries={unranked} playerHref={playerHref} />
        </div>
        <aside className="hidden flex-col gap-6 lg:flex">
          {myEntry ? <YourPositionCard ranked={ranked} me={myEntry} /> : null}
          <StreaksCard entries={ranked} me={me} />
        </aside>
      </div>
    </div>
  );
}
