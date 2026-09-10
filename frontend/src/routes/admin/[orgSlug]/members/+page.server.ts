import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveOrgIdBySlug } from '$lib/server/resolveIds';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import { MembershipClaimStatus } from '$api3';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId } = await parent();

  const [members, inviteLinks, claimRequests] = await Promise.all([
    apiClientV3.organizationMembersApi.listMembers(orgId),
    apiClientV3.organizationInviteLinksApi.listInviteLinks(orgId),
    apiClientV3.organizationClaimRequestsApi.list(
      orgId,
      MembershipClaimStatus.Pending
    ),
  ]);

  return { members, inviteLinks, claimRequests };
};

export const actions: Actions = {
  invite: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    const displayName = (
      (formData.get('displayName') as string | null) ?? ''
    ).trim();
    const username = ((formData.get('username') as string | null) ?? '').trim();

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.inviteMember(orgId, {
        email,
        role: role as never,
        displayName: displayName || undefined,
        username: username || undefined,
      });
      return { success: 'Member invited successfully' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to invite member'
      );
      return fail(details.status, { error: details.message });
    }
  },

  updateRole: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;
    const role = formData.get('role') as string;

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.updateMemberRole(
        orgId,
        membershipId,
        { role: role as never }
      );
      return { success: 'Role updated successfully' };
    } catch (error) {
      const details = await getApiErrorDetails(error, 'Failed to update role');
      return fail(details.status, { error: details.message });
    }
  },

  updateProfile: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;
    const displayName = (formData.get('displayName') as string | null) ?? '';
    const username = (formData.get('username') as string | null) ?? '';
    const emailRaw = formData.get('email') as string | null;

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.updateMemberProfile(
        orgId,
        membershipId,
        {
          displayName: displayName.trim(),
          username: username.trim(),
          email: emailRaw == null ? undefined : emailRaw.trim(),
        }
      );
      return { success: 'Profile updated successfully' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to update profile'
      );
      return fail(details.status, { error: details.message });
    }
  },

  remove: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.removeMember(
        orgId,
        membershipId
      );
      return { success: 'Member removed successfully' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to remove member'
      );
      return fail(details.status, { error: details.message });
    }
  },

  createInviteLink: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const maxUsesRaw = formData.get('maxUses') as string;
    const expiresAtRaw = formData.get('expiresAt') as string;

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationInviteLinksApi.createInviteLink(orgId, {
        maxUses: maxUsesRaw ? parseInt(maxUsesRaw) : undefined,
        expiresAt: expiresAtRaw
          ? new Date(expiresAtRaw).toISOString()
          : undefined,
      });
      return { success: 'Invite link created' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to create invite link'
      );
      return fail(details.status, { error: details.message });
    }
  },

  deleteInviteLink: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const linkId = formData.get('linkId') as string;

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationInviteLinksApi.deleteInviteLink(
        orgId,
        linkId
      );
      return { success: 'Invite link deleted' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to delete invite link'
      );
      return fail(details.status, { error: details.message });
    }
  },

  approveClaim: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const claimId = formData.get('claimId')?.toString();
    if (!claimId) return fail(400, { error: 'Claim request is invalid' });

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationClaimRequestsApi.approve(orgId, claimId);
      return { success: 'Claim request approved' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to approve claim request'
      );
      return fail(details.status, { error: details.message });
    }
  },

  rejectClaim: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const claimId = formData.get('claimId')?.toString();
    const reviewNote = formData.get('reviewNote')?.toString().trim();
    if (!claimId) return fail(400, { error: 'Claim request is invalid' });

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationClaimRequestsApi.reject(orgId, claimId, {
        reviewNote: reviewNote || undefined,
      });
      return { success: 'Claim request rejected' };
    } catch (error) {
      const details = await getApiErrorDetails(
        error,
        'Failed to reject claim request'
      );
      return fail(details.status, { error: details.message });
    }
  },
};
