import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { apiClientV3 } }) => {
  const me = await apiClientV3.meApi.getMe();

  const org = me.organizations?.find((o) => o.slug === params.orgSlug);
  if (!org) {
    throw error(404, `Organization '${params.orgSlug}' not found`);
  }

  const [members, inviteLinks] = await Promise.all([
    apiClientV3.organizationMembersApi.listMembers(org.id),
    (org.role === 'Owner' || org.role === 'Moderator')
      ? apiClientV3.organizationInviteLinksApi.listInviteLinks(org.id)
      : Promise.resolve([]),
  ]);

  return { org, members, inviteLinks, me };
};

export const actions: Actions = {
  invite: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;

    const me = await apiClientV3.meApi.getMe();
    const org = me.organizations?.find((o) => o.slug === params.orgSlug);
    if (!org) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.inviteMember(org.id, { email, role: role as any });
      return { success: 'Member invited successfully' };
    } catch {
      return fail(400, { error: 'Failed to invite member' });
    }
  },

  updateRole: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;
    const role = formData.get('role') as string;

    const me = await apiClientV3.meApi.getMe();
    const org = me.organizations?.find((o) => o.slug === params.orgSlug);
    if (!org) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.updateMemberRole(org.id, membershipId, { role: role as any });
      return { success: 'Role updated successfully' };
    } catch {
      return fail(400, { error: 'Failed to update role' });
    }
  },

  remove: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;

    const me = await apiClientV3.meApi.getMe();
    const org = me.organizations?.find((o) => o.slug === params.orgSlug);
    if (!org) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.removeMember(org.id, membershipId);
      return { success: 'Member removed successfully' };
    } catch {
      return fail(400, { error: 'Failed to remove member' });
    }
  },

  createInviteLink: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const maxUses = formData.get('maxUses') as string;
    const expiresAt = formData.get('expiresAt') as string;

    const me = await apiClientV3.meApi.getMe();
    const org = me.organizations?.find((o) => o.slug === params.orgSlug);
    if (!org) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationInviteLinksApi.createInviteLink(org.id, {
        maxUses: maxUses ? parseInt(maxUses) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      return { success: 'Invite link created' };
    } catch {
      return fail(400, { error: 'Failed to create invite link' });
    }
  },

  deleteInviteLink: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const linkId = formData.get('linkId') as string;

    const me = await apiClientV3.meApi.getMe();
    const org = me.organizations?.find((o) => o.slug === params.orgSlug);
    if (!org) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationInviteLinksApi.deleteInviteLink(org.id, linkId);
      return { success: 'Invite link deleted' };
    } catch {
      return fail(400, { error: 'Failed to delete invite link' });
    }
  },
};
