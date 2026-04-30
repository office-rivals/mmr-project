import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId } = await parent();

  try {
    const [players, members] = await Promise.all([
      apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
      apiClientV3.organizationMembersApi.listMembers(orgId),
    ]);

    return {
      players,
      members,
    };
  } catch {
    throw error(500, 'Failed to load players');
  }
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
    const displayName =
      formData.get(`${fieldName}_displayName`)?.toString().trim() ?? '';
    const username =
      formData.get(`${fieldName}_username`)?.toString().trim() ?? '';
    const email = formData.get(`${fieldName}_email`)?.toString().trim() ?? '';

    if (displayName === '') {
      return { error: 'New players must have a display name' };
    }

    return {
      newPlayer: {
        displayName,
        username: username || undefined,
        email: email || undefined,
      },
    };
  }

  return { error: 'Player selection is invalid' };
}

type ResolvedPlayerReference = Exclude<
  ReturnType<typeof resolvePlayerReference>,
  { error: string } | null
>;

function isResolvedPlayerReference(
  player: ReturnType<typeof resolvePlayerReference>
): player is ResolvedPlayerReference {
  return player !== null && !('error' in player);
}

export const actions: Actions = {
  default: async ({ request, locals: { apiClientV3 }, params }) => {
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

    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();

    if (!orgId || !leagueId) {
      return fail(400, { message: 'Organization and league are required' });
    }

    const team1PlayerRefs = ['team1_player1', 'team1_player2']
      .filter((fieldName) => (formData.get(fieldName)?.toString() ?? '') !== '')
      .map((fieldName) => resolvePlayerReference(formData, fieldName));
    const team2PlayerRefs = ['team2_player1', 'team2_player2']
      .filter((fieldName) => (formData.get(fieldName)?.toString() ?? '') !== '')
      .map((fieldName) => resolvePlayerReference(formData, fieldName));

    const allPlayerRefs = [...team1PlayerRefs, ...team2PlayerRefs];
    const playerError = allPlayerRefs.find(
      (player) => player && 'error' in player
    );
    if (playerError && 'error' in playerError) {
      return fail(400, { message: playerError.error });
    }

    const teams = [
      {
        players: team1PlayerRefs.filter(isResolvedPlayerReference),
        score: team1Score,
      },
      {
        players: team2PlayerRefs.filter(isResolvedPlayerReference),
        score: team2Score,
      },
    ];

    try {
      await apiClientV3.matchesApi.submitMatch(orgId, leagueId, { teams });
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to submit match'
      );
      return fail(status, { message });
    }

    throw redirect(303, `/${params.orgSlug}/${params.leagueSlug}`);
  },
};
