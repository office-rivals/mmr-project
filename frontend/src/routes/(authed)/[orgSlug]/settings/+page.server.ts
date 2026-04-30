import { error, redirect } from '@sveltejs/kit';
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

  if (org.role !== 'Owner') {
    throw error(403, 'Only organization owners can access settings');
  }

  return {
    org,
    me,
  };
};

export const actions: Actions = {
  update: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;

    const meResponse = await fetch('/api/v3/me');
    if (!meResponse.ok) {
      return { error: 'Failed to load user profile' };
    }
    const me = await meResponse.json();

    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    if (!org) {
      return { error: 'Organization not found' };
    }

    const response = await fetch(`/api/v3/organizations/${org.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { error: errorBody.detail || 'Failed to update organization' };
    }

    const updated = await response.json();
    if (updated.slug !== params.orgSlug) {
      redirect(303, `/${updated.slug}/settings`);
    }

    return { success: true };
  },
};
