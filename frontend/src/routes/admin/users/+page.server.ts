import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PlayerRole } from '../../../api';

export const load: PageServerLoad = async ({ locals, parent }) => {
  const parentData = await parent();
  if (parentData.userRole !== PlayerRole.Owner && parentData.userRole !== PlayerRole.Moderator) {
    error(403, 'Only moderators and owners can manage users');
  }

  const apiClient = locals.apiClient;

  try {
    const users = await apiClient.adminUsersApi.adminUsersGetUsers();
    return { users, userRole: parentData.userRole };
  } catch (err) {
    console.error('Failed to load users', err);
    throw error(500, 'Failed to load users');
  }
};

export const actions = {
  updateUser: async ({ request, locals }) => {
    const apiClient = locals.apiClient;

    const formData = await request.formData();

    const userId = Number(formData.get('userId'));
    const name = formData.get('name') as string;
    const displayName = formData.get('displayName') as string | null;
    const role = formData.get('role') as string;
    const originalName = formData.get('originalName') as string;
    const originalDisplayName = formData.get('originalDisplayName') as
      | string
      | null;
    const originalRole = formData.get('originalRole') as string;

    const nameChanged = name !== originalName;
    const displayNameChanged =
      (displayName || '') !== (originalDisplayName || '');
    const roleChanged = role !== null && role !== originalRole;

    // Validate userId
    if (!userId || userId <= 0 || isNaN(userId)) {
      return fail(400, {
        success: false,
        message: 'Invalid user ID. Must be a positive number.',
      });
    }

    // Validate name
    if (!name?.trim()) {
      return fail(400, {
        success: false,
        message: 'Name is required and cannot be empty',
      });
    }

    // Validate role
    if (roleChanged) {
      const validRoles = Object.values(PlayerRole);
      if (!validRoles.includes(role as PlayerRole)) {
        return fail(400, {
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        });
      }
    }

    // If nothing changed, return early
    if (!nameChanged && !displayNameChanged && !roleChanged) {
      return { success: true, message: 'No changes to save' };
    }

    // Use consolidated endpoint to update user
    try {
      await apiClient.adminUsersApi.adminUsersUpdateUser({
        userId,
        updateUserRequest: {
          name: nameChanged ? name : undefined,
          displayName: displayNameChanged
            ? displayName || undefined
            : undefined,
          role: roleChanged
            ? (role as PlayerRole)
            : undefined,
        },
      });

      return { success: true, message: 'User updated successfully' };
    } catch (err: unknown) {
      // Handle ResponseError from the fetch API
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response: Response }).response;
        const status = response.status;

        // Try to get the error message from the response body
        let errorMessage = 'Failed to update user';
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore parsing errors
        }

        // Return appropriate status code based on backend response
        if (status === 400) {
          return fail(400, {
            success: false,
            message: `Validation error: ${errorMessage}`,
          });
        } else if (status === 403) {
          return fail(403, {
            success: false,
            message: `Permission denied: ${errorMessage}`,
          });
        } else if (status === 404) {
          return fail(404, {
            success: false,
            message: 'User not found',
          });
        }
      }

      // Generic error handling
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      return fail(500, {
        success: false,
        message: `Failed to update user: ${message}`,
      });
    }
  },
} satisfies Actions;
