import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveOrgAndLeague } from '$lib/server/resolveIds';

export const load: PageServerLoad = async ({ parent, fetch }) => {
  const { orgId, leagueId } = await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const [playersResponse, membersResponse] = await Promise.all([
    fetch(`${base}/players`),
    fetch(`/api/v3/organizations/${orgId}/members`),
  ]);

  if (!playersResponse.ok || !membersResponse.ok) {
    throw error(500, 'Failed to load players');
  }

  const [players, members] = await Promise.all([
    playersResponse.json(),
    membersResponse.json(),
  ]);

  return {
    players,
    members,
  };
};

function resolvePlayerReference(formData: FormData, fieldName: string) {
  const rawValue = formData.get(fieldName)?.toString() ?? '';
  if (rawValue === '') {
    return null;
  }

  if (rawValue.startsWith('league:')) {
    return {
      leaguePlayerId: rawValue.slice('league:'.length),
    };
  }

  if (rawValue.startsWith('member:')) {
    return {
      organizationMembershipId: rawValue.slice('member:'.length),
    };
  }

  if (rawValue === 'new') {
    const displayName = formData.get(`${fieldName}_displayName`)?.toString().trim() ?? '';
    const email = formData.get(`${fieldName}_email`)?.toString().trim() ?? '';

    if (displayName === '') {
      return { error: 'New players must have a display name' };
    }

    return {
      newPlayer: {
        displayName,
        email: email || undefined,
      },
    };
  }

  return { error: 'Player selection is invalid' };
}

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

    const team1PlayerRefs = ['team1_player1', 'team1_player2']
      .filter((fieldName) => (formData.get(fieldName)?.toString() ?? '') !== '')
      .map((fieldName) => resolvePlayerReference(formData, fieldName));
    const team2PlayerRefs = ['team2_player1', 'team2_player2']
      .filter((fieldName) => (formData.get(fieldName)?.toString() ?? '') !== '')
      .map((fieldName) => resolvePlayerReference(formData, fieldName));

    const allPlayerRefs = [...team1PlayerRefs, ...team2PlayerRefs];
    const playerError = allPlayerRefs.find((player) => player && 'error' in player);
    if (playerError && 'error' in playerError) {
      return fail(400, { message: playerError.error });
    }

    const teams = [
      {
        players: team1PlayerRefs,
        score: team1Score,
      },
      {
        players: team2PlayerRefs,
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

    throw redirect(303, `/${params.orgSlug}/${params.leagueSlug}`);
  },
};
