import { error } from '@sveltejs/kit';

export async function resolveOrgAndLeague(
  fetchFn: typeof fetch,
  params: { orgSlug: string; leagueSlug: string }
) {
  const meRes = await fetchFn('/api/v3/me');
  const me = await meRes.json();
  const org = me.organizations?.find(
    (o: { slug: string }) => o.slug === params.orgSlug
  );
  const league = org?.leagues?.find(
    (l: { slug: string }) => l.slug === params.leagueSlug
  );
  if (!org || !league) {
    throw error(404, 'Organization or league not found');
  }
  return {
    orgId: org.id as string,
    leagueId: league.id as string,
    base: `/api/v3/organizations/${org.id}/leagues/${league.id}`,
  };
}

export async function resolveOrgIdBySlug(
  apiClientV3: App.Locals['apiClientV3'],
  orgSlug: string | undefined
): Promise<string | null> {
  if (!orgSlug) return null;
  const me = await apiClientV3.meApi.getMe();
  return (me.organizations ?? []).find((o) => o.slug === orgSlug)?.id ?? null;
}

export async function resolveLeagueIdBySlug(
  apiClientV3: App.Locals['apiClientV3'],
  orgId: string,
  leagueSlug: string | undefined
): Promise<string | null> {
  if (!leagueSlug) return null;
  const leagues = await apiClientV3.leaguesApi.listLeagues(orgId);
  return leagues.find((l) => l.slug === leagueSlug)?.id ?? null;
}

export async function resolveOrgAndLeagueIds(
  apiClientV3: App.Locals['apiClientV3'],
  params: { orgSlug?: string; leagueSlug?: string }
): Promise<{ orgId: string; leagueId: string } | null> {
  const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
  if (!orgId) return null;
  const leagueId = await resolveLeagueIdBySlug(
    apiClientV3,
    orgId,
    params.leagueSlug
  );
  if (!leagueId) return null;
  return { orgId, leagueId };
}
