import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isModeratorOrAbove } from '$lib/utils';
import type { MeOrganizationResponse } from '$api3';

// Promise.allSettled semantics for a single awaited call, so the two requests
// stay independently recoverable while still running in order.
const settle = <T>(p: Promise<T>) =>
  p.then(
    (value) => ({ status: 'fulfilled' as const, value }),
    () => ({ status: 'rejected' as const, value: undefined })
  );

export const load: LayoutServerLoad = async ({ locals }) => {
  const { userId } = locals.auth();

  if (!userId) {
    return redirect(307, '/login');
  }

  let organizations: MeOrganizationResponse[] = [];
  let displayName: string | null = null;
  let username: string | null = null;
  let defaultOrgSlug: string | null = null;
  let defaultLeagueSlug: string | null = null;
  let defaultOrgId: string | null = null;
  let defaultLeagueId: string | null = null;
  let defaultLeaguePlayerId: string | null = null;
  // Total open match flags across every org this user administers; drives the
  // "needs attention" badge on the account/admin controls. 0 for non-admins.
  let openFlagCount = 0;
  // True when getMe() itself errored (transient API/auth failure) — distinct
  // from a successful load that returns zero organizations. Routes that need a
  // loaded profile (e.g. the league layout) must check this and fail loudly;
  // profile-independent routes (/settings, /random) can ignore it and degrade.
  let profileLoadFailed = false;

  const meResult = await settle(locals.apiClientV3.meApi.getMe());

  if (meResult.status === 'fulfilled') {
    // Reading the payload stays guarded: a malformed profile must degrade the
    // same way a failed request does, not throw out of the layout and 500 the
    // whole authenticated tree.
    try {
      const me = meResult.value;
      organizations = me.organizations ?? [];
      displayName = me.displayName ?? null;
      username = me.username ?? null;
      // Default to the first org that actually has a league — organizations[0]
      // may be a league-less org (e.g. freshly created / invite-only), which
      // would otherwise leave the defaults null and hide the header switcher.
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
    const badgesResult = await settle(locals.apiClientV3.meApi.getBadges());
    if (badgesResult.status === 'fulfilled') {
      openFlagCount = badgesResult.value.openMatchFlags?.total ?? 0;
    }
  }

  return {
    userId,
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
};
