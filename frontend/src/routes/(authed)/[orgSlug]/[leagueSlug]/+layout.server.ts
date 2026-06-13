import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, parent }) => {
  const { organizations, profileLoadFailed } = await parent();

  if (profileLoadFailed) {
    throw error(401, 'Failed to load user profile');
  }

  const org = organizations.find((o) => o.slug === params.orgSlug);
  if (!org) {
    throw error(404, 'Organization not found');
  }

  const league = org.leagues?.find((l) => l.slug === params.leagueSlug);
  if (!league) {
    throw error(404, 'League not found');
  }

  return {
    orgId: org.id as string,
    leagueId: league.id as string,
    leagueTeamSize: league.teamSize as number,
    leagueWinningScore: league.winningScore ?? null,
    leaguePlayerId: (league.leaguePlayerId || null) as string | null,
    orgSlug: params.orgSlug,
    leagueSlug: params.leagueSlug,
    orgRole: org.role,
  };
};
