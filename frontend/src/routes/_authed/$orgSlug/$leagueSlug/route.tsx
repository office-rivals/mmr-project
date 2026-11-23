import { Outlet, createFileRoute } from '@tanstack/react-router';
import { HttpErrorView } from '@/components/http-error-view';
import { HttpError } from '@/lib/http-error';
import { createRouteGuard } from '@/lib/server/http-error';
import { loadShellDataOnce } from '@/lib/server/shell';
import type { OrganizationRole } from '@/api-v3';
import type { AuthedShellData } from '@/lib/shell';

/**
 * League context published to every descendant route and to the bottom navbar.
 * It replaces `page.data.orgId / leagueId / leaguePlayerId` from SvelteKit.
 */
export interface LeagueContext {
  orgId: string;
  leagueId: string;
  leagueTeamSize: number;
  leagueWinningScore: number | null;
  /** `null` when the signed-in user has not joined this league. */
  leaguePlayerId: string | null;
  orgSlug: string;
  leagueSlug: string;
  orgRole: OrganizationRole;
}

/**
 * Zero API calls — the league is resolved purely from the `_authed` route's
 * `getMe()` payload.
 *
 * `profileLoadFailed` is a 401 and is deliberately distinct from "getMe
 * succeeded and this org/league isn't in it", which is a 404. Merging them
 * turns a transient API blip into a permanent-looking "not found".
 */
export function resolveLeague(
  shell: AuthedShellData,
  params: { orgSlug: string; leagueSlug: string }
): LeagueContext {
  if (shell.profileLoadFailed) {
    throw new HttpError(401, 'Failed to load user profile');
  }

  const org = shell.organizations.find((o) => o.slug === params.orgSlug);
  if (!org) throw new HttpError(404, 'Organization not found');

  const league = org.leagues?.find((l) => l.slug === params.leagueSlug);
  if (!league) throw new HttpError(404, 'League not found');

  return {
    orgId: org.id,
    leagueId: league.id,
    leagueTeamSize: league.teamSize,
    leagueWinningScore: league.winningScore ?? null,
    // `||`, not `??`: an empty string means "not a member of this league".
    leaguePlayerId: league.leaguePlayerId || null,
    orgSlug: params.orgSlug,
    leagueSlug: params.leagueSlug,
    orgRole: org.role,
  };
}

const leagueGuard = createRouteGuard(async ({ params }) => {
  resolveLeague(await loadShellDataOnce(), {
    orgSlug: params.orgSlug ?? '',
    leagueSlug: params.leagueSlug ?? '',
  });
});

export const Route = createFileRoute('/_authed/$orgSlug/$leagueSlug')({
  server: { middleware: [leagueGuard] },
  // In `beforeLoad`, not `loader`: it runs top-down and short-circuits the
  // whole subtree, so a child loader never runs against an unresolved league.
  beforeLoad: async ({ context, params }) => {
    return { league: resolveLeague(context.authedShell, params) };
  },
  // Exposed twice on purpose: `context.league` for child loaders/beforeLoads,
  // loader data for components and for the navbar's `useMatch`.
  loader: ({ context }) => context.league,
  errorComponent: HttpErrorView,
  component: LeagueLayout,
});

// Pure pass-through: no chrome, no tabs, no sub-navigation. All league
// navigation lives in the header switcher and the bottom navbar.
function LeagueLayout() {
  return <Outlet />;
}
