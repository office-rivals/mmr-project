import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
  const parentData = await parent();
  if (parentData.userRole !== 'Owner') {
    error(403, 'Only owners can manage roles');
  }

  const apiClient = locals.apiClient;
  const users = await apiClient.usersApi.usersGetUsers();

  return { users };
};

export const actions = {
  assignRole: async ({ request, locals }) => {
    const apiClient = locals.apiClient;
    const formData = await request.formData();

    const playerId = Number(formData.get('playerId'));
    const role = formData.get('role') as 'User' | 'Moderator' | 'Owner';

    try {
      await apiClient.rolesApi.rolesAssignRole({
        assignRoleRequest: { playerId, role },
      });
      return { success: true, message: `Role updated to ${role}` };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return fail(500, {
          success: false,
          message: err.message || 'Failed to assign role',
        });
      }
      return fail(500, {
        success: false,
        message: 'Failed to assign role',
      });
    }
  },
} satisfies Actions;
