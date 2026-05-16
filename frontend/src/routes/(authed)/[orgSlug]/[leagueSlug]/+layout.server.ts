import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, parent }) => {
  const { organizations } = await parent();

  const org = organizations.find((o) => o.slug === params.orgSlug);
  if (!org) {
    throw error(404, 'Organization not found');
  }

  const league = org.leagues?.find((l) => l.slug === params.leagueSlug);
  if (!league) {
    throw error(404, 'League not found');
  }

  return {
    orgId: org.id,
    leagueId: league.id,
    leaguePlayerId: league.leaguePlayerId,
    orgSlug: params.orgSlug,
    leagueSlug: params.leagueSlug,
    orgRole: org.role,
  };
};
