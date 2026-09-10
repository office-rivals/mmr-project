import { auth } from '@clerk/tanstack-react-start/server';
import { getRequest } from '@tanstack/react-start/server';
import { requireApiClientV3 } from './apiClientV3';
import { isModeratorOrAbove } from '@/lib/utils';
import type { MeOrganizationResponse } from '@/api-v3';
import type { AuthedShellData } from '@/lib/shell';

// Promise.allSettled semantics for a single awaited call, so the two requests
// stay independently recoverable while still running in order.
const settle = <T>(p: Promise<T>) =>
  p.then(
    (value) => ({ status: 'fulfilled' as const, value }),
    () => ({ status: 'rejected' as const, value: undefined })
  );

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
  let openFlagCount = 0;

  const meResult = await settle(apiClientV3.meApi.getMe());

  if (meResult.status === 'fulfilled') {
    // Reading the payload stays guarded: a malformed profile must degrade the
    // same way a failed request does, not throw out of the shell loader.
    try {
      const me = meResult.value;
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
      organizations = [];
      profileLoadFailed = true;
    }
  } else {
    profileLoadFailed = true;
  }

  // Only admins can act on flags, and only the profile says who is one — so
  // this runs after getMe() rather than alongside it, and not at all for the
  // majority of users, who would just be paying a round trip to be told zero.
  // (getMe() also provisions the user row and claims pending invites, which is
  // what the counts are derived from, so the ordering is required regardless.)
  if (organizations.some((o) => isModeratorOrAbove(o.role))) {
    const badgesResult = await settle(apiClientV3.meApi.getBadges());
    if (badgesResult.status === 'fulfilled') {
      openFlagCount = badgesResult.value.openMatchFlags?.total ?? 0;
    }
  }

  return {
    userId: userId ?? null,
    organizations,
    profileLoadFailed,
    displayName,
    username,
    openFlagCount,
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
