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
  updateUser: async ({ request, locals }) => {
    const apiClient = locals.apiClient;
    const formData = await request.formData();

    const userId = Number(formData.get('userId'));
    const name = formData.get('name') as string;
    const displayName = formData.get('displayName') as string | null;
    const role = formData.get('role') as 'User' | 'Moderator' | 'Owner';
    const originalName = formData.get('originalName') as string;
    const originalDisplayName = formData.get('originalDisplayName') as string | null;
    const originalRole = formData.get('originalRole') as 'User' | 'Moderator' | 'Owner';

    const nameChanged = name !== originalName;
    const displayNameChanged = (displayName || '') !== (originalDisplayName || '');
    const roleChanged = role !== originalRole;

    const errors: string[] = [];
    let detailsUpdated = false;
    let roleUpdated = false;

    // Update user details if name or displayName changed
    if (nameChanged || displayNameChanged) {
      try {
        await apiClient.usersApi.usersUpdateUser({
          userId,
          updateUserRequest: {
            name: nameChanged ? name : undefined,
            displayName: displayNameChanged ? (displayName || undefined) : undefined,
          },
        });
        detailsUpdated = true;
      } catch (err: unknown) {
        if (err instanceof Error) {
          errors.push(`User details: ${err.message}`);
        } else {
          errors.push('Failed to update user details');
        }
      }
    }

    // Update role if it changed
    if (roleChanged) {
      try {
        await apiClient.rolesApi.rolesAssignRole({
          assignRoleRequest: { playerId: userId, role },
        });
        roleUpdated = true;
      } catch (err: unknown) {
        if (err instanceof Error) {
          errors.push(`Role: ${err.message}`);
        } else {
          errors.push('Failed to update role');
        }
      }
    }

    // Determine success based on what was attempted and what succeeded
    if (errors.length === 0) {
      return { success: true, message: 'User updated successfully' };
    }

    // Partial success scenarios
    if (detailsUpdated && !roleUpdated && roleChanged) {
      return fail(500, {
        success: false,
        message: `User details updated, but role update failed: ${errors.join(', ')}`,
      });
    }

    if (roleUpdated && !detailsUpdated && (nameChanged || displayNameChanged)) {
      return fail(500, {
        success: false,
        message: `Role updated, but user details failed: ${errors.join(', ')}`,
      });
    }

    // Complete failure
    return fail(500, {
      success: false,
      message: `Failed to update user: ${errors.join(', ')}`,
    });
  },
} satisfies Actions;
