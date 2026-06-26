import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { MeOrganizationResponse } from '$lib/../api-v3/models';

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

  // Fetch profile and badge counts together; badges are non-fatal so a failure
  // there never marks the profile as failed.
  const [meResult, badgesResult] = await Promise.allSettled([
    locals.apiClientV3.meApi.getMe(),
    locals.apiClientV3.meApi.getBadges(),
  ]);

  if (meResult.status === 'fulfilled') {
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
  } else {
    profileLoadFailed = true;
  }

  if (badgesResult.status === 'fulfilled') {
    openFlagCount = badgesResult.value.openMatchFlags?.total ?? 0;
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
