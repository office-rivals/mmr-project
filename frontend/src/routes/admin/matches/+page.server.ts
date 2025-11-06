import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
  await parent();
  const apiClient = locals.apiClient;

  try {
    const [matches, users, seasons] = await Promise.all([
      apiClient.mmrApi.mMRV2GetMatches({
        limit: 30,
        offset: 0,
      }),
      apiClient.usersApi.usersGetUsers(),
      apiClient.seasonsApi.seasonsGetSeasons(),
    ]);

    const currentSeason = seasons?.[0];

    return {
      matches: matches ?? [],
      users: users ?? [],
      seasonId: currentSeason?.id ?? null,
    };
  } catch (error) {
    console.error('Failed to load matches:', error);
    return {
      matches: [],
      users: [],
      seasonId: null,
    };
  }
};

export const actions = {
  recalculate: async ({ request, locals }) => {
    const apiClient = locals.apiClient;
    const formData = await request.formData();
    const fromMatchIdRaw = formData.get('fromMatchId');

    let fromMatchId: number | undefined = undefined;
    if (fromMatchIdRaw && typeof fromMatchIdRaw === 'string') {
      const trimmed = fromMatchIdRaw.trim();
      if (trimmed.length > 0 && /^\d+$/.test(trimmed)) {
        const parsed = parseInt(trimmed, 10);
        if (Number.isInteger(parsed) && parsed > 0) {
          fromMatchId = parsed;
        }
      }
    }

    try {
      await apiClient.adminMmrApi.adminMMRRecalculateMMR({
        fromMatchId,
      });
      return {
        success: true,
        message: 'MMR recalculation started successfully',
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return fail(500, {
          success: false,
          message: err.message || 'Failed to start recalculation',
        });
      }
      return fail(500, {
        success: false,
        message: 'Failed to start recalculation',
      });
    }
  },

  editMatch: async ({ request, locals }) => {
    const apiClient = locals.apiClient;
    const formData = await request.formData();

    const matchIdStr = formData.get('matchId') as string;
    const seasonIdStr = formData.get('seasonId') as string;
    const team1Player1Str = formData.get('team1Player1') as string;
    const team1Player2Str = formData.get('team1Player2') as string;
    const team1ScoreStr = formData.get('team1Score') as string;
    const team2Player1Str = formData.get('team2Player1') as string;
    const team2Player2Str = formData.get('team2Player2') as string;
    const team2ScoreStr = formData.get('team2Score') as string;

    if (!matchIdStr || !seasonIdStr || !team1Player1Str || !team1Player2Str || !team1ScoreStr || !team2Player1Str || !team2Player2Str || !team2ScoreStr) {
      return fail(400, {
        success: false,
        message: 'All fields are required',
      });
    }

    const matchId = parseInt(matchIdStr, 10);
    const seasonId = parseInt(seasonIdStr, 10);
    const team1Player1 = parseInt(team1Player1Str, 10);
    const team1Player2 = parseInt(team1Player2Str, 10);
    const team1Score = parseInt(team1ScoreStr, 10);
    const team2Player1 = parseInt(team2Player1Str, 10);
    const team2Player2 = parseInt(team2Player2Str, 10);
    const team2Score = parseInt(team2ScoreStr, 10);

    if (isNaN(matchId) || isNaN(seasonId) || isNaN(team1Player1) || isNaN(team1Player2) || isNaN(team1Score) || isNaN(team2Player1) || isNaN(team2Player2) || isNaN(team2Score)) {
      return fail(400, {
        success: false,
        message: 'Invalid form data',
      });
    }

    try {
      // Step 1: Update the match
      await apiClient.adminMatchApi.adminMatchUpdateMatch({
        matchId,
        updateMatchRequest: {
          seasonId,
          team1: {
            member1: team1Player1,
            member2: team1Player2,
            score: team1Score,
          },
          team2: {
            member1: team2Player1,
            member2: team2Player2,
            score: team2Score,
          },
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        return fail(500, {
          success: false,
          message: err.message || 'Failed to update match',
        });
      }
      return fail(500, {
        success: false,
        message: 'Failed to update match',
      });
    }

    try {
      // Step 2: Recalculate MMR from this match onwards
      await apiClient.adminMmrApi.adminMMRRecalculateMMR({
        fromMatchId: matchId,
      });

      return {
        success: true,
        message: 'Match updated and MMR recalculated successfully',
      };
    } catch (err: unknown) {
      // Match updated successfully but recalculation failed
      return {
        success: true,
        warning: 'Match updated successfully, but MMR recalculation failed. Please use the recalculation tool below.',
      };
    }
  },

  deleteMatch: async ({ request, locals }) => {
    const apiClient = locals.apiClient;
    const formData = await request.formData();

    const matchId = parseInt(formData.get('matchId') as string, 10);

    try {
      // Step 1: Delete the match
      await apiClient.adminMatchApi.adminMatchDeleteMatch({
        matchId,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        return fail(500, {
          success: false,
          message: err.message || 'Failed to delete match',
        });
      }
      return fail(500, {
        success: false,
        message: 'Failed to delete match',
      });
    }

    try {
      // Step 2: Recalculate MMR from this match onwards
      await apiClient.adminMmrApi.adminMMRRecalculateMMR({
        fromMatchId: matchId,
      });

      return {
        success: true,
        message: 'Match deleted and MMR recalculated successfully',
      };
    } catch (err: unknown) {
      // Match deleted successfully but recalculation failed
      return {
        success: true,
        warning: 'Match deleted successfully, but MMR recalculation failed. Please use the recalculation tool below.',
      };
    }
  },
} satisfies Actions;
