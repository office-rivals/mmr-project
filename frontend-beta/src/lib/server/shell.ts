import { auth } from '@clerk/tanstack-react-start/server';
import { getRequest } from '@tanstack/react-start/server';
import { requireApiClientV3 } from './apiClientV3';
import type { MeOrganizationResponse } from '@/api-v3';
import type { AuthedShellData } from '@/lib/shell';

/**
 * Server-side port of `(authed)/+layout.server.ts`.
 *
 * It deliberately never throws on a `getMe()` failure: `profileLoadFailed`
 * distinguishes "the call errored" from "the call succeeded and returned zero
 * orgs". `/settings` and `/random` degrade on the former, the league layout
 * 401s on it, and `/` renders its empty state. A loader that threw here would
 * break all three.
 */
export async function loadShellData(): Promise<AuthedShellData> {
  const { userId } = await auth();
  const apiClientV3 = await requireApiClientV3();

  let organizations: MeOrganizationResponse[] = [];
  let displayName: string | null = null;
  let username: string | null = null;
  let defaultOrgSlug: string | null = null;
  let defaultLeagueSlug: string | null = null;
  let defaultOrgId: string | null = null;
  let defaultLeagueId: string | null = null;
  let defaultLeaguePlayerId: string | null = null;
  let profileLoadFailed = false;

  try {
    const me = await apiClientV3.meApi.getMe();
    organizations = me.organizations ?? [];
    displayName = me.displayName ?? null;
    username = me.username ?? null;
    // First org that actually HAS a league, not organizations[0] — a
    // league-less org would otherwise null out every default and hide the
    // header switcher.
    const org = organizations.find((o) => (o.leagues?.length ?? 0) > 0);
    const league = org?.leagues?.[0];
    if (org && league) {
      defaultOrgSlug = org.slug;
      defaultLeagueSlug = league.slug;
      defaultOrgId = org.id;
      defaultLeagueId = league.id;
      defaultLeaguePlayerId = league.leaguePlayerId ?? null;
    }
  } catch {
    profileLoadFailed = true;
  }

  return {
    userId: userId ?? null,
    organizations,
    profileLoadFailed,
    displayName,
    username,
    defaultOrgSlug,
    defaultLeagueSlug,
    defaultOrgId,
    defaultLeagueId,
    defaultLeaguePlayerId,
  };
}

const perRequest = new WeakMap<Request, Promise<AuthedShellData>>();

/**
 * `loadShellData()` memoised per HTTP request.
 *
 * A document request can reach it twice — once from a route `server.middleware`
 * RBAC guard and once from the `_authed` loader's server function — and both
 * want the same snapshot. When the two do not share a `Request` instance the
 * memo simply misses and the second caller pays for its own round-trip, which
 * is still the SvelteKit behaviour.
 */
export function loadShellDataOnce(): Promise<AuthedShellData> {
  let request: Request | undefined;
  try {
    request = getRequest();
  } catch {
    request = undefined;
  }
  if (!request) return loadShellData();

  const cached = perRequest.get(request);
  if (cached) return cached;

  const promise = loadShellData();
  perRequest.set(request, promise);
  return promise;
}
