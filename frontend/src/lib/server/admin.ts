import { resolveAdminOrg } from '@/lib/admin';
import { loadShellDataOnce } from './shell';
import type { AdminOrg } from '@/lib/admin';
import type { ApiClientV3 } from './apiClientV3';

/**
 * Server-side half of the org gate. Every admin *loader* server function calls
 * it, so a hand-rolled RPC cannot read another org's data by passing a slug the
 * caller does not administer — the route guard alone would not stop that.
 */
export async function requireAdminOrg(orgSlug: string): Promise<AdminOrg> {
  return resolveAdminOrg(await loadShellDataOnce(), orgSlug);
}

/**
 * Port of `frontend/src/lib/server/resolveIds.ts`.
 *
 * SvelteKit form actions get no `parent()` data, so every admin mutation
 * re-resolved its ids from the URL slugs — at the cost of one or two extra API
 * calls per mutation. The React server functions keep that shape: the id is
 * never trusted from the client, and the `me` lookup is what implicitly scopes
 * a mutation to an org the caller belongs to (the API enforces the role).
 */
export async function resolveOrgIdBySlug(
  apiClientV3: ApiClientV3,
  orgSlug: string | undefined
): Promise<string | null> {
  if (!orgSlug) return null;
  const me = await apiClientV3.meApi.getMe();
  return (me.organizations ?? []).find((o) => o.slug === orgSlug)?.id ?? null;
}

export async function resolveLeagueIdBySlug(
  apiClientV3: ApiClientV3,
  orgId: string,
  leagueSlug: string | undefined
): Promise<string | null> {
  if (!leagueSlug) return null;
  const leagues = await apiClientV3.leaguesApi.listLeagues(orgId);
  return leagues.find((l) => l.slug === leagueSlug)?.id ?? null;
}

export async function resolveOrgAndLeagueIds(
  apiClientV3: ApiClientV3,
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
