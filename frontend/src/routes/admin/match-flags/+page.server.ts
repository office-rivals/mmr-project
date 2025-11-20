import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { MatchFlagStatus } from '../../../api';

export const load: PageServerLoad = async ({ parent, locals }) => {
  await parent();
  const apiClient = locals.apiClient;

  try {
    const [flags, users, seasons] = await Promise.all([
      apiClient.adminMatchFlagsApi.adminMatchFlagsGetPendingFlags(),
      apiClient.usersApi.usersGetUsers(),
      apiClient.seasonsApi.seasonsGetSeasons(),
    ]);

    const currentSeason = seasons?.[0];

    return {
      flags: flags ?? [],
      users: users ?? [],
      seasonId: currentSeason?.id ?? null,
    };
  } catch (error) {
    console.error('Failed to load match flags:', error);
    return {
      flags: [],
      users: [],
      seasonId: null,
    };
  }
};

export const actions = {
  resolve: async ({ request, locals }) => {
    const apiClient = locals.apiClient;
    const formData = await request.formData();

    const flagId = parseInt(formData.get('flagId') as string, 10);
    const note = (formData.get('note') as string)?.trim() || undefined;

    if (isNaN(flagId)) {
      return fail(400, {
        success: false,
        message: 'Invalid flag ID',
      });
    }

    try {
      await apiClient.adminMatchFlagsApi.adminMatchFlagsUpdateFlag({
        id: flagId,
        updateMatchFlagRequest: {
          status: MatchFlagStatus.Resolved,
          note,
        },
      });

      return {
        success: true,
        message: 'Flag resolved successfully',
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return fail(500, {
          success: false,
          message: err.message || 'Failed to resolve flag',
        });
      }
      return fail(500, {
        success: false,
        message: 'Failed to resolve flag',
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
      await apiClient.adminMmrApi.adminMMRRecalculateMMR({
        fromMatchId: matchId,
      });

      return {
        success: true,
        message: 'Match updated and MMR recalculated successfully',
      };
    } catch (err: unknown) {
      return {
        success: true,
        warning: 'Match updated successfully, but MMR recalculation failed.',
      };
    }
  },
} satisfies Actions;
