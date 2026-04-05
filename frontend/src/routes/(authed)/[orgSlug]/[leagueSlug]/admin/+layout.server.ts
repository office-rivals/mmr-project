import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
  const { orgRole } = await parent();

  if (orgRole !== 'Owner' && orgRole !== 'Moderator') {
    throw error(403, 'You do not have permission to access this page');
  }
};
