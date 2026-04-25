import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function resolveOrgId(
  apiClientV3: App.Locals['apiClientV3'],
  orgSlug: string | undefined
): Promise<string | null> {
  if (!orgSlug) return null;
  const me = await apiClientV3.meApi.getMe();
  return (me.organizations ?? []).find((o) => o.slug === orgSlug)?.id ?? null;
}

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId } = await parent();

  const [members, inviteLinks] = await Promise.all([
    apiClientV3.organizationMembersApi.listMembers(orgId),
    apiClientV3.organizationInviteLinksApi.listInviteLinks(orgId),
  ]);

  return { members, inviteLinks };
};

export const actions: Actions = {
  invite: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;

    const orgId = await resolveOrgId(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.inviteMember(orgId, {
        email,
        role: role as never,
      });
      return { success: 'Member invited successfully' };
    } catch {
      return fail(400, { error: 'Failed to invite member' });
    }
  },

  updateRole: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;
    const role = formData.get('role') as string;

    const orgId = await resolveOrgId(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.updateMemberRole(
        orgId,
        membershipId,
        { role: role as never }
      );
      return { success: 'Role updated successfully' };
    } catch {
      return fail(400, { error: 'Failed to update role' });
    }
  },

  remove: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;

    const orgId = await resolveOrgId(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.removeMember(
        orgId,
        membershipId
      );
      return { success: 'Member removed successfully' };
    } catch {
      return fail(400, { error: 'Failed to remove member' });
    }
  },

  createInviteLink: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const maxUsesRaw = formData.get('maxUses') as string;
    const expiresAtRaw = formData.get('expiresAt') as string;

    const orgId = await resolveOrgId(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationInviteLinksApi.createInviteLink(orgId, {
        maxUses: maxUsesRaw ? parseInt(maxUsesRaw) : undefined,
        expiresAt: expiresAtRaw
          ? new Date(expiresAtRaw).toISOString()
          : undefined,
      });
      return { success: 'Invite link created' };
    } catch {
      return fail(400, { error: 'Failed to create invite link' });
    }
  },

  deleteInviteLink: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const linkId = formData.get('linkId') as string;

    const orgId = await resolveOrgId(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationInviteLinksApi.deleteInviteLink(
        orgId,
        linkId
      );
      return { success: 'Invite link deleted' };
    } catch {
      return fail(400, { error: 'Failed to delete invite link' });
    }
  },
};
