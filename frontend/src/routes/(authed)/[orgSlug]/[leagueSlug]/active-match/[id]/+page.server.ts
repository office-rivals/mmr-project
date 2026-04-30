import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';

export const load: PageServerLoad = async ({
  params,
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId, leaguePlayerId, orgSlug, leagueSlug } =
    await parent();
  const activeMatchId = params.id;
  const activeMatches = await apiClientV3.activeMatchesApi.listActiveMatches(
    orgId,
    leagueId
  );
  const activeMatch = activeMatches.find(
    (m: { id: string }) => m.id === activeMatchId
  );

  if (!activeMatch) {
    throw error(404, 'Active match not found');
  }

  const players = await apiClientV3.leaguePlayersApi.listPlayers(
    orgId,
    leagueId
  );

  return {
    activeMatch,
    players,
    currentLeaguePlayerId: leaguePlayerId,
    orgSlug,
    leagueSlug,
  };
};

export const actions: Actions = {
  default: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const teams = [];

    const team1Score = Number(formData.get('team1_score'));
    const team2Score = Number(formData.get('team2_score'));

    if (isNaN(team1Score) || isNaN(team2Score)) {
      return fail(400, { message: 'Scores are required' });
    }

    teams.push({ teamIndex: 0, score: team1Score });
    teams.push({ teamIndex: 1, score: team2Score });

    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();

    if (!orgId || !leagueId) {
      return fail(400, { message: 'Organization and league are required' });
    }

    try {
      await apiClientV3.activeMatchesApi.submitResult(
        orgId,
        leagueId,
        params.id,
        {
          teams,
        }
      );
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to submit match result'
      );
      return fail(status, {
        message,
      });
    }

    throw redirect(303, `/${params.orgSlug}/${params.leagueSlug}`);
  },
};
