import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
  await parent();
  const apiClient = locals.apiClient;

  try {
    const [matches, users] = await Promise.all([
      apiClient.mmrApi.mMRV2GetMatches({
        limit: 30,
        offset: 0,
      }),
      apiClient.usersApi.usersGetUsers(),
    ]);

    return {
      matches: matches ?? [],
      users: users ?? [],
    };
  } catch (error) {
    console.error('Failed to load matches:', error);
    return {
      matches: [],
      users: [],
    };
  }
};

export const actions = {
  recalculate: async ({ request, locals }) => {
    const apiClient = locals.apiClient;
    const formData = await request.formData();
    const fromMatchId = formData.get('fromMatchId');

    try {
      await apiClient.adminApi.adminRecalculateMatches({
        fromMatchId: fromMatchId ? Number(fromMatchId) : undefined,
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
} satisfies Actions;
