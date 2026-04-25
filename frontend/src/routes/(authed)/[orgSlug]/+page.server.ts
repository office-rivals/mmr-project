import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
  params,
  locals: { apiClientV3 },
}) => {
  const me = await apiClientV3.meApi.getMe();
  const org = me.organizations?.find(
    (organization) => organization.slug === params.orgSlug
  );
  if (!org) {
    throw error(404, `Organization '${params.orgSlug}' not found`);
  }

  const leagues = await apiClientV3.leaguesApi.listLeagues(org.id);
  const joinedLeagueIds = new Set(
    (org.leagues ?? []).map((league) => league.id)
  );

  return {
    org,
    leagues: leagues.map((league) => ({
      ...league,
      isJoined: joinedLeagueIds.has(league.id),
    })),
  };
};

export const actions: Actions = {
  joinLeague: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const leagueId = formData.get('leagueId')?.toString();
    const leagueSlug = formData.get('leagueSlug')?.toString();

    if (!leagueId || !leagueSlug) {
      return fail(400, { error: 'League selection is invalid' });
    }

    const me = await apiClientV3.meApi.getMe();
    const org = me.organizations?.find(
      (organization) => organization.slug === params.orgSlug
    );
    if (!org) {
      return fail(404, { error: 'Organization not found' });
    }

    try {
      await apiClientV3.leaguePlayersApi.joinLeague(org.id, leagueId);
    } catch {
      return fail(400, { error: 'Failed to join league' });
    }

    throw redirect(303, `/${params.orgSlug}/${leagueSlug}`);
  },
};
