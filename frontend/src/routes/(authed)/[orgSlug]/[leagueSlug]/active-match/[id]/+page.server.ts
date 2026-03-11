import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, fetch }) => {
  const { orgId, leagueId, leaguePlayerId, orgSlug, leagueSlug } =
    await parent();
  const activeMatchId = params.id;
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const activeMatchesResponse = await fetch(`${base}/matchmaking/active`);
  if (!activeMatchesResponse.ok) {
    throw error(500, 'Failed to load active matches');
  }

  const activeMatches = await activeMatchesResponse.json();
  const activeMatch = activeMatches.find(
    (m: { id: string }) => m.id === activeMatchId
  );

  if (!activeMatch) {
    throw error(404, 'Active match not found');
  }

  const playersResponse = await fetch(`${base}/players`);
  const players = playersResponse.ok ? await playersResponse.json() : [];

  return {
    activeMatch,
    players,
    currentLeaguePlayerId: leaguePlayerId,
    orgSlug,
    leagueSlug,
  };
};

export const actions: Actions = {
  default: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const teams = [];

    const team1Score = Number(formData.get('team1_score'));
    const team2Score = Number(formData.get('team2_score'));

    if (isNaN(team1Score) || isNaN(team2Score)) {
      return fail(400, { message: 'Scores are required' });
    }

    teams.push({ teamIndex: 0, score: team1Score });
    teams.push({ teamIndex: 1, score: team2Score });

    const meResponse = await fetch('/api/v3/me');
    const me = await meResponse.json();
    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    const league = org?.leagues?.find(
      (l: { slug: string }) => l.slug === params.leagueSlug
    );

    if (!org || !league) {
      return fail(404, { message: 'Organization or league not found' });
    }

    const base = `/api/v3/organizations/${org.id}/leagues/${league.id}`;

    const response = await fetch(
      `${base}/matchmaking/active/${params.id}/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return fail(response.status, {
        message: errorData?.detail ?? 'Failed to submit match result',
      });
    }

    redirect(303, `/${params.orgSlug}/${params.leagueSlug}`);
  },
};
