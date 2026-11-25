import { error, redirect } from '@sveltejs/kit';
import { OrganizationRole } from '$api3';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({
  params,
  locals: { apiClientV3 },
}) => {
  const { orgSlug } = params;

  const me = await apiClientV3.meApi.getMe();

  const org = me.organizations.find((o) => o.slug === orgSlug);
  if (!org) {
    throw error(404, `Organization '${orgSlug}' not found`);
  }

  if (org.role !== OrganizationRole.Owner) {
    throw error(403, 'Only organization owners can access settings');
  }

  return {
    org,
    me,
  };
};

export const actions: Actions = {
  update: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;

    const me = await apiClientV3.meApi.getMe();

    const org = me.organizations.find((o) => o.slug === params.orgSlug);
    if (!org) {
      return { error: 'Organization not found' };
    }

    let updated;
    try {
      updated = await apiClientV3.organizationsApi.updateOrganization(org.id, {
        name,
        slug,
      });
    } catch (err) {
      const { message } = await getApiErrorDetails(
        err,
        'Failed to update organization'
      );
      return { error: message };
    }

    if (updated.slug !== params.orgSlug) {
      redirect(303, `/${updated.slug}/settings`);
    }

    return { success: true };
  },
};
