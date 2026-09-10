import {
  Link,
  Outlet,
  createFileRoute,
  getRouteApi,
  useLocation,
} from '@tanstack/react-router';
import { LayoutDashboard, Trophy, Users } from 'lucide-react';
import { OpenFlagBadge } from '@/components/admin/open-flag-badge';
import { HttpErrorView } from '@/components/http-error-view';
import { resolveAdminOrg } from '@/lib/admin';
import { createRouteGuard } from '@/lib/server/http-error';
import { loadShellDataOnce } from '@/lib/server/shell';
import { authedShellQueryOptions } from '@/lib/shell';
import { cn, openFlagsForOrg } from '@/lib/utils';

/**
 * The org gate. Attached to the layout route, so it covers every descendant
 * document request — `/admin/other-org/leagues/other-league/matches` 403s
 * before the league layout ever looks for the league (spec 06 §11.6/10).
 */
const orgGuard = createRouteGuard(async ({ params }) => {
  resolveAdminOrg(await loadShellDataOnce(), params.orgSlug ?? '');
});

export const Route = createFileRoute('/admin/$orgSlug')({
  server: { middleware: [orgGuard] },
  // In `beforeLoad` so it short-circuits the subtree on client navigation the
  // same way the guard short-circuits the document request.
  beforeLoad: async ({ context, params }) => {
    const shell = await context.queryClient.ensureQueryData(
      authedShellQueryOptions()
    );
    return { org: resolveAdminOrg(shell, params.orgSlug) };
  },
  // Published twice: `context.org` for descendant loaders, loader data for the
  // admin shell's `useMatch` and for this layout's children.
  loader: ({ context }) => context.org,
  errorComponent: HttpErrorView,
  component: OrgAdminLayout,
});

const adminRoute = getRouteApi('/admin');

function OrgAdminLayout() {
  const org = Route.useLoaderData();
  const { badges } = adminRoute.useLoaderData();
  const { pathname } = useLocation();
  const base = `/admin/${org.slug}`;

  const navItems = [
    {
      to: '/admin/$orgSlug' as const,
      href: base,
      label: 'Overview',
      icon: LayoutDashboard,
      exact: true,
      badge: 0,
    },
    {
      to: '/admin/$orgSlug/members' as const,
      href: `${base}/members`,
      label: 'Members',
      icon: Users,
      exact: false,
      badge: 0,
    },
    {
      to: '/admin/$orgSlug/leagues' as const,
      href: `${base}/leagues`,
      label: 'Leagues',
      icon: Trophy,
      exact: false,
      badge: openFlagsForOrg(badges, org.id),
    },
  ];

  const isActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-56 lg:shrink-0">
        {/* The first <nav> in the admin DOM — `admin.spec` disambiguates the
            sidebar "Members" link from the overview's "Manage members" button
            with getByRole('navigation').first(). */}
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                to={item.to}
                params={{ orgSlug: org.slug }}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/80 hover:bg-accent'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                <OpenFlagBadge
                  count={item.badge}
                  variant="count"
                  className="ml-auto"
                />
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
