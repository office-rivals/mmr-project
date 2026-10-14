import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Heatmap, LineChart } from '@/components/charts';
import { HttpErrorView } from '@/components/http-error-view';
import { PageTitle } from '@/components/page-title';
import { SeasonPicker } from '@/components/season-picker';
import { HttpError } from '@/lib/http-error';
import { createRouteGuard } from '@/lib/server/http-error';
import { loadShellDataOnce } from '@/lib/server/shell';
import { loadStatisticsOnce } from '@/lib/server/statistics';
import { resolveLeague } from './route';
import type { StatisticsData } from '@/lib/server/statistics';

type StatisticsResult =
  | { ok: true; data: StatisticsData }
  | { ok: false; status: number; message: string };

const getStatisticsFn = createServerFn({ method: 'GET' })
  .validator(
    (input: { orgSlug: string; leagueSlug: string; season?: string }) => input
  )
  .handler(async ({ data }): Promise<StatisticsResult> => {
    try {
      // Ids re-derived from `getMe()` server-side, never taken from the client.
      const league = resolveLeague(await loadShellDataOnce(), {
        orgSlug: data.orgSlug,
        leagueSlug: data.leagueSlug,
      });
      const statistics = await loadStatisticsOnce({
        orgId: league.orgId,
        leagueId: league.leagueId,
        season: data.season,
      });
      return { ok: true, data: statistics };
    } catch (error) {
      if (error instanceof HttpError) {
        return { ok: false, status: error.status, message: error.message };
      }
      throw error;
    }
  });

/**
 * Document requests get a real 500 with the message `Failed to load
 * statistics`, matching `throw error(500, …)` in the Svelte load. Route server
 * middleware is the only place a document response can carry an arbitrary
 * status — a loader throw alone renders `errorComponent` inside a 200.
 *
 * The per-request memo in `loadStatisticsOnce` means the loader below reuses
 * what this guard already fetched instead of running the leaderboard call and
 * the ten-way rating-history fan-out twice.
 */
const statisticsGuard = createRouteGuard(async ({ params, request }) => {
  const url = new URL(request.url);
  // `/:orgSlug/:leagueSlug/statistics` — the path is the fallback source for
  // the two slugs, because route params are handed to request middleware by the
  // runtime rather than by its type.
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const orgSlug = params.orgSlug ?? segments[0] ?? '';
  const leagueSlug = params.leagueSlug ?? segments[1] ?? '';

  const league = resolveLeague(await loadShellDataOnce(), {
    orgSlug,
    leagueSlug,
  });
  await loadStatisticsOnce({
    orgId: league.orgId,
    leagueId: league.leagueId,
    // `listSeasons` failing is deliberately NOT an `HttpError`: it propagates
    // as a plain 500, exactly as it did outside the Svelte try/catch.
    season: url.searchParams.get('season') ?? undefined,
  });
});

export const Route = createFileRoute(
  '/_authed/$orgSlug/$leagueSlug/statistics'
)({
  server: { middleware: [statisticsGuard] },
  validateSearch: (search: Record<string, unknown>) => ({
    season: typeof search.season === 'string' ? search.season : undefined,
  }),
  loaderDeps: ({ search: { season } }) => ({ season }),
  loader: async ({ params, deps }) => {
    const result = await getStatisticsFn({
      data: {
        orgSlug: params.orgSlug,
        leagueSlug: params.leagueSlug,
        season: deps.season,
      },
    });
    // Covers client-side navigation only (`errorComponent` renders it); the
    // guard above is what gives a document request the real status code.
    if (!result.ok) throw new HttpError(result.status, result.message);
    return result.data;
  },
  errorComponent: HttpErrorView,
  component: StatisticsPage,
});

function StatisticsPage() {
  const data = Route.useLoaderData();
  const { season } = Route.useSearch();
  const navigate = Route.useNavigate();

  // Pure rename: name→player, mmr→rating; `date` passes through as an ISO string.
  const chartData =
    data.statistics?.map((stat) => ({
      player: stat.name,
      date: stat.date,
      rating: stat.mmr,
    })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Statistics</PageTitle>
      {data.seasons != null &&
      data.seasons.length > 1 &&
      data.currentSeason != null ? (
        <div className="self-end">
          <SeasonPicker
            seasons={data.seasons}
            currentSeason={data.currentSeason}
            selectedSeasonId={season}
            onSeasonChange={(next) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  season:
                    next.id === data.currentSeason?.id ? undefined : next.id,
                }),
                replace: true,
              })
            }
          />
        </div>
      ) : null}
      {/* Always mounted, legend on, even with zero series — e2e asserts exactly
          two chart holders and the heatmap below is conditional. */}
      <LineChart data={chartData} height={500} />

      {data.timeDistribution && data.timeDistribution.length > 0 ? (
        <>
          <h2 className="text-2xl md:text-4xl">Match frequency</h2>
          <Heatmap data={data.timeDistribution} />
        </>
      ) : null}
    </div>
  );
}
