import { auth } from '@clerk/tanstack-react-start/server';
import { getRequest } from '@tanstack/react-start/server';
import { requireApiClientV3 } from './apiClientV3';
import { isModeratorOrAbove } from '@/lib/utils';
import type { MeOrganizationResponse } from '@/api-v3';
import type { AuthedShellData } from '@/lib/shell';

const settle = <T>(p: Promise<T>) =>
  p.then(
    (value) => ({ status: 'fulfilled' as const, value }),
    () => ({ status: 'rejected' as const, value: undefined })
  );

/** Profile-independent routes render a degraded shell when `getMe()` fails. */
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
    // Treat a malformed profile like a failed request.
    try {
      const me = meResult.value;
      organizations = me.organizations ?? [];
      displayName = me.displayName ?? null;
      username = me.username ?? null;
      // Skip league-less orgs so a later org can supply navigation defaults.
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

  // getMe() provisions memberships that badge counts depend on.
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

/** Share one profile fetch between guards and loaders in the same request. */
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
