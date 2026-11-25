import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { HttpErrorView } from '@/components/http-error-view';
import { PageTitle } from '@/components/page-title';
import { OccupancyBadge } from '@/features/foosball/occupancy';
import { listTablesWithUnclaimedFn } from '@/features/foosball/unclaimed';

export const Route = createFileRoute('/_authed/$orgSlug/$leagueSlug/tables/')({
  loader: ({ context: { league } }) =>
    listTablesWithUnclaimedFn({
      data: { orgId: league.orgId, leagueId: league.leagueId },
    }),
  errorComponent: HttpErrorView,
  component: TablesPage,
});

function TablesPage() {
  const { league } = Route.useRouteContext();
  const { orgSlug, leagueSlug } = Route.useParams();
  // Kept fresh so players can check a table is free before walking over.
  const { data: tables } = useQuery({
    queryKey: ['foosball-tables', league.leagueId],
    queryFn: () =>
      listTablesWithUnclaimedFn({
        data: { orgId: league.orgId, leagueId: league.leagueId },
      }),
    initialData: Route.useLoaderData(),
    refetchInterval: 15_000,
  });
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Tables</PageTitle>
      {tables.map(({ table, unclaimed }) => (
        <Link
          key={table.id}
          to="/$orgSlug/$leagueSlug/tables/$tableId"
          params={{ orgSlug, leagueSlug, tableId: table.id }}
          className="flex items-center justify-between gap-2 rounded-lg border bg-card p-4 hover:bg-accent/40"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{table.name}</span>
            <OccupancyBadge table={table} />
          </span>
          {unclaimed.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {unclaimed.length} to claim
            </span>
          )}
        </Link>
      ))}
      {tables.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No tables set up yet.
        </p>
      )}
    </div>
  );
}
