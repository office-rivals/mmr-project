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
  // True when getMe() itself errored (transient API/auth failure) — distinct
  // from a successful load that returns zero organizations. Routes that need a
  // loaded profile (e.g. the league layout) must check this and fail loudly;
  // profile-independent routes (/settings, /random) can ignore it and degrade.
  let profileLoadFailed = false;

  try {
    const me = await locals.apiClientV3.meApi.getMe();
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
    profileLoadFailed = true;
  }

  return {
    userId,
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
};
