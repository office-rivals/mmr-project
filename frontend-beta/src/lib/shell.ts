import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { loadShellDataOnce } from '@/lib/server/shell';
import type { MeOrganizationResponse } from '@/api-v3';

/**
 * The `(authed)` layout data contract (spec 01 §9.1), unchanged. Every authed
 * route reads it; nothing else in the app is allowed to call `getMe()` for
 * org/league/role resolution.
 */
export interface AuthedShellData {
  userId: string | null;
  organizations: MeOrganizationResponse[];
  /** True only when `getMe()` itself threw — not when it returned zero orgs. */
  profileLoadFailed: boolean;
  displayName: string | null;
  username: string | null;
  /**
   * Total open match flags across every org this user administers; drives the
   * "needs attention" badge on the account/admin controls. 0 for non-admins.
   */
  openFlagCount: number;
  defaultOrgSlug: string | null;
  defaultLeagueSlug: string | null;
  defaultOrgId: string | null;
  defaultLeagueId: string | null;
  defaultLeaguePlayerId: string | null;
}

/** The one query key the whole shell hangs off. */
export const meQueryKey = ['me'] as const;

export const getAuthedShellData = createServerFn({ method: 'GET' }).handler(
  (): Promise<AuthedShellData> => loadShellDataOnce()
);

/**
 * `staleTime: 0` is deliberate and is what replaces SvelteKit's
 * `invalidateAll: true`: a league join, an org rename or a league switch must
 * be visible in the header and navbar on the very next navigation, and
 * pull-to-refresh's `router.invalidate()` must actually issue a request.
 */
export const authedShellQueryOptions = () =>
  queryOptions({
    queryKey: meQueryKey,
    queryFn: () => getAuthedShellData(),
    staleTime: 0,
  });
