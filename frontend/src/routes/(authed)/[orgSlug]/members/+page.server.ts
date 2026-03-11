import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const { orgSlug } = params;

  const meResponse = await fetch('/api/v3/me');
  if (!meResponse.ok) {
    throw error(500, 'Failed to load user profile');
  }
  const me = await meResponse.json();

  const org = me.organizations?.find(
    (o: { slug: string }) => o.slug === orgSlug
  );
  if (!org) {
    throw error(404, `Organization '${orgSlug}' not found`);
  }

  const membersResponse = await fetch(
    `/api/v3/organizations/${org.id}/members`
  );
  if (!membersResponse.ok) {
    throw error(500, 'Failed to load members');
  }
  const members = await membersResponse.json();

  return {
    org,
    members,
    me,
  };
};

export const actions: Actions = {
  invite: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;

    const meResponse = await fetch('/api/v3/me');
    const me = await meResponse.json();
    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    if (!org) {
      return { error: 'Organization not found' };
    }

    const response = await fetch(`/api/v3/organizations/${org.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { error: errorBody.detail || 'Failed to invite member' };
    }

    return { success: 'Member invited successfully' };
  },

  updateRole: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;
    const role = formData.get('role') as string;

    const meResponse = await fetch('/api/v3/me');
    const me = await meResponse.json();
    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    if (!org) {
      return { error: 'Organization not found' };
    }

    const response = await fetch(
      `/api/v3/organizations/${org.id}/members/${membershipId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { error: errorBody.detail || 'Failed to update role' };
    }

    return { success: 'Role updated successfully' };
  },

  remove: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId') as string;

    const meResponse = await fetch('/api/v3/me');
    const me = await meResponse.json();
    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    if (!org) {
      return { error: 'Organization not found' };
    }

    const response = await fetch(
      `/api/v3/organizations/${org.id}/members/${membershipId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { error: errorBody.detail || 'Failed to remove member' };
    }

    return { success: 'Member removed successfully' };
  },
};
