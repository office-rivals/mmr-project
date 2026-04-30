import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const { userId } = locals.auth();

  if (!userId) {
    return redirect(307, '/login');
  }

  let defaultOrgSlug: string | null = null;
  let defaultLeagueSlug: string | null = null;
  let defaultOrgId: string | null = null;
  let defaultLeagueId: string | null = null;
  let defaultLeaguePlayerId: string | null = null;

  try {
    const me = await locals.apiClientV3.meApi.getMe();
    const org = me.organizations?.[0];
    const league = org?.leagues?.[0];
    if (org && league) {
      defaultOrgSlug = org.slug;
      defaultLeagueSlug = league.slug;
      defaultOrgId = org.id;
      defaultLeagueId = league.id;
      defaultLeaguePlayerId = league.leaguePlayerId ?? null;
    }
  } catch {
    // user has no orgs yet — that's fine
  }

  return {
    userId,
    defaultOrgSlug,
    defaultLeagueSlug,
    defaultOrgId,
    defaultLeagueId,
    defaultLeaguePlayerId,
  };
};
