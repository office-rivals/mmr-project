import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ parent, fetch, url }) => {
  const { orgId, leagueId } = await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const seasonId = url.searchParams.get('season') ?? undefined;
  const seasonQuery = seasonId ? `?seasonId=${seasonId}` : '';

  const [leaderboardRes, matchesRes, seasonsRes, playersRes, queueRes, myFlagsRes] =
    await Promise.all([
      fetch(`${base}/leaderboard${seasonQuery}`),
      fetch(`${base}/matches?limit=5&offset=0`),
      fetch(`${base}/seasons`),
      fetch(`${base}/players`),
      fetch(`${base}/matchmaking/queue`).catch(() => null),
      fetch(`${base}/match-flags/me`).catch(() => null),
    ]);

  if (!leaderboardRes.ok) {
    throw error(500, 'Failed to load leaderboard');
  }

  const leaderboard = await leaderboardRes.json();
  const matches = matchesRes.ok ? await matchesRes.json() : [];
  const seasons = seasonsRes.ok ? await seasonsRes.json() : [];
  const players = playersRes.ok ? await playersRes.json() : [];
  const queueStatus = queueRes?.ok ? await queueRes.json() : null;
  const myFlags = myFlagsRes?.ok ? await myFlagsRes.json() : [];

  return {
    leaderboard,
    recentMatches: matches,
    seasons,
    currentSeason: seasons[0] ?? null,
    players,
    queueStatus,
    myFlags,
  };
};

export const actions = {
  flagMatch: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;
    const reason = (formData.get('reason') as string)?.trim();

    if (!matchId || !reason) {
      return fail(400, { success: false, message: 'Match ID and reason are required' });
    }

    const meRes = await fetch('/api/v3/me');
    const me = await meRes.json();
    const org = me.organizations?.find((o: { slug: string }) => o.slug === params.orgSlug);
    const league = org?.leagues?.find((l: { slug: string }) => l.slug === params.leagueSlug);
    if (!org || !league) return fail(404, { success: false, message: 'Not found' });

    const res = await fetch(
      `/api/v3/organizations/${org.id}/leagues/${league.id}/match-flags`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, reason }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return fail(res.status, { success: false, message: body.detail || 'Failed to create flag' });
    }

    return { success: true, message: 'Match flagged successfully' };
  },

  updateFlag: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;
    const reason = (formData.get('reason') as string)?.trim();

    if (!flagId || !reason) {
      return fail(400, { success: false, message: 'Flag ID and reason are required' });
    }

    const meRes = await fetch('/api/v3/me');
    const me = await meRes.json();
    const org = me.organizations?.find((o: { slug: string }) => o.slug === params.orgSlug);
    const league = org?.leagues?.find((l: { slug: string }) => l.slug === params.leagueSlug);
    if (!org || !league) return fail(404, { success: false, message: 'Not found' });

    const res = await fetch(
      `/api/v3/organizations/${org.id}/leagues/${league.id}/match-flags/${flagId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return fail(res.status, { success: false, message: body.detail || 'Failed to update flag' });
    }

    return { success: true, message: 'Flag updated successfully' };
  },

  deleteFlag: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;

    if (!flagId) {
      return fail(400, { success: false, message: 'Flag ID is required' });
    }

    const meRes = await fetch('/api/v3/me');
    const me = await meRes.json();
    const org = me.organizations?.find((o: { slug: string }) => o.slug === params.orgSlug);
    const league = org?.leagues?.find((l: { slug: string }) => l.slug === params.leagueSlug);
    if (!org || !league) return fail(404, { success: false, message: 'Not found' });

    const res = await fetch(
      `/api/v3/organizations/${org.id}/leagues/${league.id}/match-flags/${flagId}`,
      { method: 'DELETE' }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return fail(res.status, { success: false, message: body.detail || 'Failed to delete flag' });
    }

    return { success: true, message: 'Flag deleted successfully' };
  },
} satisfies Actions;
