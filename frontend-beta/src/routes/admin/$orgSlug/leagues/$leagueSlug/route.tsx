import {
  Link,
  Outlet,
  createFileRoute,
  getRouteApi,
  useLocation,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  CalendarDays,
  ClipboardList,
  Flag,
  LayoutDashboard,
} from 'lucide-react';
import { HttpErrorView } from '@/components/http-error-view';
import { OpenFlagBadge } from '@/components/admin/open-flag-badge';
import { resolveAdminOrg } from '@/lib/admin';
import { HttpError } from '@/lib/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { requireAdminOrg } from '@/lib/server/admin';
import { createRouteGuard } from '@/lib/server/http-error';
import { loadShellDataOnce } from '@/lib/server/shell';
import { authedShellQueryOptions } from '@/lib/shell';
import { cn, openFlagsForLeague } from '@/lib/utils';
import type { LeagueResponse } from '@/api-v3';

const listLeaguesFn = createServerFn({ method: 'GET' })
  .validator((orgSlug: string) => orgSlug)
  .handler(async ({ data: orgSlug }): Promise<LeagueResponse[]> => {
    const org = await requireAdminOrg(orgSlug);
    const apiClientV3 = await requireApiClientV3();
    return apiClientV3.leaguesApi.listLeagues(org.id);
  });

function findLeague(leagues: LeagueResponse[], leagueSlug: string) {
  const league = leagues.find((l) => l.slug === leagueSlug);
  if (!league) throw new HttpError(404, `League '${leagueSlug}' not found`);
  return league;
}

/**
 * The league 404. It runs *after* the org guard on the parent layout, so a
 * Member-only org still 403s on `/admin/other-org/leagues/other-league` rather
 * than leaking a 404 (spec 06 §11.6/10).
 */
const leagueGuard = createRouteGuard(async ({ params }) => {
  const org = resolveAdminOrg(await loadShellDataOnce(), params.orgSlug ?? '');
  const apiClientV3 = await requireApiClientV3();
  findLeague(
    await apiClientV3.leaguesApi.listLeagues(org.id),
    params.leagueSlug ?? ''
  );
});

export const Route = createFileRoute('/admin/$orgSlug/leagues/$leagueSlug')({
  server: { middleware: [leagueGuard] },
  beforeLoad: async ({ params }) => {
    const leagues = await listLeaguesFn({ data: params.orgSlug });
    const league = findLeague(leagues, params.leagueSlug);
    return {
      league,
      leagueId: league.id,
      leagueSlug: league.slug,
      leagueAdminBase: `/admin/${params.orgSlug}/leagues/${league.slug}`,
    };
  },
  loader: ({ context }) => ({
    league: context.league,
    leagueAdminBase: context.leagueAdminBase,
  }),
  errorComponent: HttpErrorView,
  component: LeagueAdminLayout,
});

const adminRoute = getRouteApi('/admin');

function LeagueAdminLayout() {
  const { orgSlug, leagueSlug } = Route.useParams();
  const { league, leagueAdminBase } = Route.useLoaderData();
  const { badges } = adminRoute.useLoaderData();
  const { pathname } = useLocation();

  const subnav = [
    {
      to: '/admin/$orgSlug/leagues/$leagueSlug' as const,
      href: leagueAdminBase,
      label: 'Overview',
      icon: LayoutDashboard,
      exact: true,
      badge: 0,
    },
    {
      to: '/admin/$orgSlug/leagues/$leagueSlug/matches' as const,
      href: `${leagueAdminBase}/matches`,
      label: 'Matches',
      icon: ClipboardList,
      exact: false,
      badge: 0,
    },
    {
      to: '/admin/$orgSlug/leagues/$leagueSlug/match-flags' as const,
      href: `${leagueAdminBase}/match-flags`,
      label: 'Flags',
      icon: Flag,
      exact: false,
      badge: openFlagsForLeague(badges, league.id),
    },
    {
      to: '/admin/$orgSlug/leagues/$leagueSlug/seasons' as const,
      href: `${leagueAdminBase}/seasons`,
      label: 'Seasons',
      icon: CalendarDays,
      exact: false,
      badge: 0,
    },
  ];

  const isActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          League
        </p>
        <h2 className="text-xl font-semibold">{league.name}</h2>
      </div>

      <nav className="flex flex-row gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1">
        {subnav.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              to={item.to}
              params={{ orgSlug, leagueSlug }}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              <OpenFlagBadge count={item.badge} variant="count" />
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
