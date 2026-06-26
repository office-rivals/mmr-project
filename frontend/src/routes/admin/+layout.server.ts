import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// TODO(super-admin): once the super-admin role lands, gate this layout on
// `user.isSuperAdmin === true` and redirect non-super-admins to their primary
// org admin page (or just back to `/`). Until then we accept any authenticated
// user — the per-org `/admin/[orgSlug]/+layout.server.ts` enforces the real
// authorization for everything that actually matters.
export const load: LayoutServerLoad = async ({ locals: { apiClientV3 } }) => {
  let me;
  let badges;
  try {
    // Badges never reject the pair (own .catch); only a getMe() failure 401s,
    // preserving the prior behavior.
    [me, badges] = await Promise.all([
      apiClientV3.meApi.getMe(),
      apiClientV3.meApi.getBadges().catch(() => null),
    ]);
  } catch {
    throw error(401, 'Failed to load user profile');
  }

  return {
    me,
    badges,
  };
};
