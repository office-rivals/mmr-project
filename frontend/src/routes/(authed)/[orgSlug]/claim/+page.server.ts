import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import { resolveOrgIdBySlug } from '$lib/server/resolveIds';

export const load: PageServerLoad = async ({
  params,
  locals: { apiClientV3 },
}) => {
  const me = await apiClientV3.meApi.getMe();
  const org = me.organizations?.find(
    (organization) => organization.slug === params.orgSlug
  );
  if (!org) throw error(404, `Organization '${params.orgSlug}' not found`);

  const [claimable, claimRequest] = await Promise.all([
    apiClientV3.organizationMembersApi.listClaimable(org.id),
    apiClientV3.organizationClaimRequestsApi.getMine(org.id),
  ]);

  return { org, claimable, claimRequest };
};

export const actions: Actions = {
  submit: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const organizationMembershipId = formData.get('membershipId')?.toString();
    const note = formData.get('note')?.toString().trim();
    if (!organizationMembershipId) {
      return fail(400, { error: 'Choose the player that represents you' });
    }

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationClaimRequestsApi.create(orgId, {
        organizationMembershipId,
        note: note || undefined,
      });
      return { success: 'Claim request submitted' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to submit claim request'
      );
      return fail(details.status, { error: details.message });
    }
  },

  cancel: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const claimId = formData.get('claimId')?.toString();
    if (!claimId) return fail(400, { error: 'Claim request is invalid' });

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationClaimRequestsApi.cancel(orgId, claimId);
      return { success: 'Claim request cancelled' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to cancel claim request'
      );
      return fail(details.status, { error: details.message });
    }
  },
};
