import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { MatchFlagStatus } from '../../../api';

export const load: PageServerLoad = async ({ parent, locals }) => {
  await parent();
  const apiClient = locals.apiClient;

  try {
    const [flags, users] = await Promise.all([
      apiClient.adminMatchFlagsApi.adminMatchFlagsGetPendingFlags(),
      apiClient.usersApi.usersGetUsers(),
    ]);

    return {
      flags: flags ?? [],
      users: users ?? [],
    };
  } catch (error) {
    console.error('Failed to load match flags:', error);
    return {
      flags: [],
      users: [],
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
} satisfies Actions;
