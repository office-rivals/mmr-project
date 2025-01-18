import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClient } }) => {
  try {
    const matchmaking =
      await apiClient.matchmakingApi.matchMakingGetMatchMakingQueueStatus();
    return {
      matchmaking,
    };
  } catch (error) {
    return fail(500, {
      message: 'Failed to load matchmaking information',
    });
  }
};

export const actions = {
  default: async (event) => {
    const apiClient = event.locals.apiClient;

    const formData = await event.request.formData();
    const intent = formData.get('intent');

    if (!intent) {
      return fail(400, {
        message: 'No intent provided',
      });
    }

    if (intent === 'leave') {
      try {
        await apiClient.matchmakingApi.matchMakingLeaveMatchMakingQueue();
      } catch (error) {
        return fail(500, {
          message: 'Failed to leave matchmaking queue',
        });
      }
      return;
    }

    if (intent === 'queue') {
      try {
        await apiClient.matchmakingApi.matchMakingQueueForMatchMaking({
          body: {},
        });
        return;
      } catch (error) {
        return fail(500, {
          message: 'Failed to join matchmaking queue',
        });
      }
    }

    return fail(400, { message: 'Unknown intent' });
  },
};
