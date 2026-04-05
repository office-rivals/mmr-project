import { error } from '@sveltejs/kit';

export async function resolveOrgAndLeague(
  fetchFn: typeof fetch,
  params: { orgSlug: string; leagueSlug: string }
) {
  const meRes = await fetchFn('/api/v3/me');
  const me = await meRes.json();
  const org = me.organizations?.find((o: { slug: string }) => o.slug === params.orgSlug);
  const league = org?.leagues?.find((l: { slug: string }) => l.slug === params.leagueSlug);
  if (!org || !league) {
    throw error(404, 'Organization or league not found');
  }
  return {
    orgId: org.id as string,
    leagueId: league.id as string,
    base: `/api/v3/organizations/${org.id}/leagues/${league.id}`,
  };
}
