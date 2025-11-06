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
} satisfies Actions;
