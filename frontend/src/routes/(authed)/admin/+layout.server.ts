import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
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
