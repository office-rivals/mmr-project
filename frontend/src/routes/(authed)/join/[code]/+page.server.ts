import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { apiClientV3 } }) => {
  const [info, me] = await Promise.all([
    apiClientV3.invitesApi.getInviteInfo(params.code),
    apiClientV3.meApi.getMe(),
  ]);

  const alreadyMember = info.isValid && me.organizations.some(
    (org) => org.slug === info.organizationSlug
  );

  return { invite: info, alreadyMember };
};

export const actions: Actions = {
  join: async ({ params, locals: { apiClientV3 } }) => {
    try {
      const result = await apiClientV3.invitesApi.joinOrganization(params.code);
      throw redirect(303, `/${result.organizationSlug}`);
    } catch (e) {
      if (e && typeof e === 'object' && 'status' in e && e.status === 303) throw e;
      return fail(400, { error: 'Failed to join organization. The invite may be invalid or expired.' });
    }
  },
};
