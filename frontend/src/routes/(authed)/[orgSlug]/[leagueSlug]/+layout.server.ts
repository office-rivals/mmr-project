import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, fetch }) => {
  const meResponse = await fetch('/api/v3/me');
  if (!meResponse.ok) {
    throw error(401, 'Failed to load user profile');
  }

  const me = await meResponse.json();

  const org = me.organizations?.find(
    (o: { slug: string }) => o.slug === params.orgSlug
  );
  if (!org) {
    throw error(404, 'Organization not found');
  }

  const league = org.leagues?.find(
    (l: { slug: string }) => l.slug === params.leagueSlug
  );
  if (!league) {
    throw error(404, 'League not found');
  }

  return {
    orgId: org.id as string,
    leagueId: league.id as string,
    leaguePlayerId: league.leaguePlayerId as string | undefined,
    orgSlug: params.orgSlug,
    leagueSlug: params.leagueSlug,
    orgRole: org.role as string,
  };
};
