import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, parent, fetch, url }) => {
  const { orgId, leagueId, leaguePlayerId, orgSlug, leagueSlug } =
    await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;
  const playerId = params.id;

  const seasonId = url.searchParams.get('season') ?? undefined;
  const seasonQuery = seasonId ? `?seasonId=${seasonId}` : '';

  const [playerRes, matchesRes, historyRes, leaderboardRes, seasonsRes, myFlagsRes] =
    await Promise.all([
      fetch(`${base}/players/${playerId}`),
      fetch(`${base}/matches?leaguePlayerId=${playerId}&limit=1000&offset=0`),
      fetch(`${base}/rating-history/${playerId}${seasonQuery}`),
      fetch(`${base}/leaderboard${seasonQuery}`),
      fetch(`${base}/seasons`),
      fetch(`${base}/match-flags/me`).catch(() => null),
    ]);

  if (!playerRes.ok) {
    throw error(404, 'Player not found');
  }

  const player = await playerRes.json();
  const matches = matchesRes.ok ? await matchesRes.json() : [];
  const ratingHistory = historyRes.ok ? await historyRes.json() : { entries: [] };
  const leaderboard = leaderboardRes.ok ? await leaderboardRes.json() : { entries: [] };
  const seasons = seasonsRes.ok ? await seasonsRes.json() : [];
  const myFlags = myFlagsRes?.ok ? await myFlagsRes.json() : [];

  const playerEntry = leaderboard.entries?.find(
    (e: { leaguePlayerId: string }) => e.leaguePlayerId === playerId
  );

  const totalMatches = playerEntry?.totalMatches ?? 0;
  const wins = playerEntry?.wins ?? 0;
  const losses = playerEntry?.losses ?? 0;
  const winrate = totalMatches > 0 ? wins / totalMatches : 0;
  const mmr = playerEntry?.mmr ?? null;

  return {
    player,
    matches,
    ratingHistory,
    isCurrentUser: playerId === leaguePlayerId,
    stats: {
      mmr,
      totalMatches,
      wins,
      losses,
      winrate,
    },
    orgSlug,
    leagueSlug,
    seasons,
    currentSeason: seasons[0] ?? null,
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
