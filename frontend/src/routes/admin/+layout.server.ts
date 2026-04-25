import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// TODO(super-admin): once the super-admin role lands, gate this layout on
// `user.isSuperAdmin === true` and redirect non-super-admins to their primary
// org admin page (or just back to `/`). Until then we accept any authenticated
// user — the per-org `/admin/[orgSlug]/+layout.server.ts` enforces the real
// authorization for everything that actually matters.
export const load: LayoutServerLoad = async ({ locals: { apiClientV3 } }) => {
  let me;
  try {
    me = await apiClientV3.meApi.getMe();
  } catch {
    throw error(401, 'Failed to load user profile');
  }

  return {
    me,
  };
};
