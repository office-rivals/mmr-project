import { ResponseError } from '$api';
import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate, type ErrorStatus } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { activeMatchSubmitSchema } from './active-match-submit-schema';

export const load: PageServerLoad = async ({
  params,
  locals: { apiClient },
}) => {
  const activeMatchId = params.id;

  const activeMatch = (
    await apiClient.matchmakingApi.matchMakingGetActiveMatches()
  ).find((match) => match.id === activeMatchId);

  if (activeMatch == null) {
    throw new Error('Active match not found');
  }

  const [users, profile] = await Promise.all([
    apiClient.usersApi.usersGetUsers(),
    apiClient.profileApi.profileGetProfile(),
  ]);

  const currentPlayerId = profile.userId;
  if (currentPlayerId == null) {
    throw new Error('No user claimed');
  }

  const matchContainsUserId =
    activeMatch.team1.playerIds.includes(currentPlayerId) ||
    activeMatch.team2.playerIds.includes(currentPlayerId);

  if (!matchContainsUserId) {
    throw new Error('User not in active match');
  }

  return {
    activeMatch,
    users,
    currentPlayerId,
    form: await superValidate(zod(activeMatchSubmitSchema), {
      defaults: {
        team1Score: -1,
        team2Score: -1,
      },
    }),
  };
};

export const actions: Actions = {
  default: async (event) => {
    const apiClient = event.locals.apiClient;
    const form = await superValidate(event, zod(activeMatchSubmitSchema));

    if (!form.valid) {
      return fail(400, {
        form,
      });
    }

    try {
      await apiClient.matchmakingApi.matchMakingSubmitActiveMatchResult({
        matchId: event.params.id,
        activeMatchSubmitRequest: form.data,
      });
    } catch (error) {
      if (error instanceof ResponseError) {
        const errorResponse = await error.response.json();
        return message(form, errorResponse.error, {
          status: error.response.status as ErrorStatus,
        });
      }
      return fail(500, {
        form,
      });
    }

    throw redirect(303, '/');
  },
};
