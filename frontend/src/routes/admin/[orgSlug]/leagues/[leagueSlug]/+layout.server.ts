import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({
  params,
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, orgSlug, orgRole } = await parent();

  const leagues = await apiClientV3.leaguesApi.listLeagues(orgId);
  const league = leagues.find((l) => l.slug === params.leagueSlug);
  if (!league) {
    throw error(404, `League '${params.leagueSlug}' not found`);
  }

  return {
    league,
    leagueId: league.id,
    leagueSlug: league.slug,
    leagueAdminBase: `/admin/${orgSlug}/leagues/${league.slug}`,
    orgRole,
  };
};
