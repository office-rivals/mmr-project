import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Check authentication first
  const { userId } = locals.auth();

  if (!userId) {
    return redirect(307, '/');
  }

  // Check admin role
  const apiClient = locals.apiClient;
  const roleResponse = await apiClient.rolesApi.rolesGetMyRole();
  const userRole = roleResponse.role;

  if (userRole === 'User') {
    error(403, {
      message: 'Access denied. Admin privileges required.',
    });
  }

  return { userRole };
};
