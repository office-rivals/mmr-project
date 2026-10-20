import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { HttpErrorView } from '@/components/http-error-view';
import { PageTitle } from '@/components/page-title';
import { Alert } from '@/components/ui/alert';
import { isModeratorOrAbove } from '@/lib/utils';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { Stats } from '@/features/foosball/table-stats';
import type { TableStatsResponse } from '@/features/foosball/api';

const WEEKS = [4, 8, 12];
// METRICS.md §8: one window for every stat; the heatmap (TS2) wants 8 weeks.
const DEFAULT_WEEKS = 8;

type Ids = { orgId: string; tableId: string };

const loadTableFn = createServerFn({ method: 'GET' })
  .validator((ids: Ids) => ids)
  .handler(async ({ data }) =>
    (await requireApiClientV3()).foosballApi.getLive(data.orgId, data.tableId)
  );

const statsFn = createServerFn({ method: 'GET' })
  .validator((input: Ids & { weeks: number; tz: string }) => input)
  .handler(async ({ data }): Promise<TableStatsResponse> => {
    const weeks = WEEKS.includes(data.weeks) ? data.weeks : DEFAULT_WEEKS;
    const to = new Date();
    const from = new Date(to.getTime() - weeks * 7 * 86_400_000);
    return (await requireApiClientV3()).foosballApi.getTableStats(
      data.orgId,
      data.tableId,
      { from: from.toISOString(), to: to.toISOString(), tz: data.tz }
    );
  });

export const Route = createFileRoute(
  '/_authed/$orgSlug/$leagueSlug/tables/$tableId_/stats'
)({
  validateSearch: (search: Record<string, unknown>): { weeks?: number } =>
    WEEKS.includes(Number(search.weeks)) ? { weeks: Number(search.weeks) } : {},
  loader: async ({ context, params }) =>
    (
      await loadTableFn({
        data: { orgId: context.league.orgId, tableId: params.tableId },
      })
    ).table,
  errorComponent: HttpErrorView,
  component: StatsPage,
});

function StatsPage() {
  const table = Route.useLoaderData();
  const { league } = Route.useRouteContext();
  const { tableId } = Route.useParams();
  const { weeks = DEFAULT_WEEKS } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  // Fetched in the browser: hours and days are bucketed in the viewer's zone.
  const stats = useQuery({
    queryKey: ['foosball-stats', tableId, weeks],
    queryFn: () =>
      statsFn({
        data: {
          orgId: league.orgId,
          tableId,
          weeks,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{table.name}</PageTitle>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          Stats for the last
          <select
            value={weeks}
            onChange={(e) =>
              navigate({ search: { weeks: Number(e.target.value) } })
            }
            className="h-9 rounded-md border border-input bg-background px-2"
          >
            {WEEKS.map((w) => (
              <option key={w} value={w}>
                {w} weeks
              </option>
            ))}
          </select>
        </label>
        <Link
          to="/$orgSlug/$leagueSlug/tables/$tableId"
          params={{
            orgSlug: league.orgSlug,
            leagueSlug: league.leagueSlug,
            tableId,
          }}
          className="text-sm underline underline-offset-4"
        >
          Live score
        </Link>
      </div>

      {stats.isError && (
        <Alert variant="destructive">Failed to load the stats.</Alert>
      )}
      {stats.isPending && (
        <p className="text-center text-sm text-muted-foreground">
          Loading stats…
        </p>
      )}
      {stats.data && (
        <Stats
          stats={stats.data}
          table={table}
          admin={isModeratorOrAbove(league.orgRole)}
        />
      )}
    </div>
  );
}
