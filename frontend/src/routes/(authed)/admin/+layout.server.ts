import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { apiClient } }) => {
  const permissions = await apiClient.profileApi.profileGetProfilePermissions();

  if (permissions.isAdmin == null || !permissions.isAdmin) {
    error(403, {
      message: 'You do not have permission to access this page',
    });
  }
};
