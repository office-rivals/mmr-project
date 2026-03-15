import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveOrgAndLeague } from '$lib/server/resolveIds';

export const load: PageServerLoad = async ({ parent, fetch }) => {
  const { orgId, leagueId } = await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const playersResponse = await fetch(`${base}/players`);
  if (!playersResponse.ok) {
    throw error(500, 'Failed to load players');
  }

  const players = await playersResponse.json();

  return {
    players,
  };
};

export const actions: Actions = {
  default: async ({ request, fetch, params }) => {
    const formData = await request.formData();

    const team1Player1 = formData.get('team1_player1') as string;
    const team1Player2 = formData.get('team1_player2') as string;
    const team1Score = Number(formData.get('team1_score'));
    const team2Player1 = formData.get('team2_player1') as string;
    const team2Player2 = formData.get('team2_player2') as string;
    const team2Score = Number(formData.get('team2_score'));

    if (!team1Player1 || !team2Player1) {
      return fail(400, { message: 'Each team must have at least one player' });
    }

    if (isNaN(team1Score) || isNaN(team2Score)) {
      return fail(400, { message: 'Scores are required' });
    }

    const { base } = await resolveOrgAndLeague(fetch, params);

    const teams = [
      {
        players: [team1Player1, team1Player2].filter(Boolean),
        score: team1Score,
      },
      {
        players: [team2Player1, team2Player2].filter(Boolean),
        score: team2Score,
      },
    ];

    const response = await fetch(`${base}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return fail(response.status, {
        message: errorData?.detail ?? 'Failed to submit match',
      });
    }

    redirect(303, `/${params.orgSlug}/${params.leagueSlug}`);
  },
};
