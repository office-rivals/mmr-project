import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, parent }) => {
  const { me } = await parent();

  const org = (me.organizations ?? []).find((o) => o.slug === params.orgSlug);
  if (!org) {
    throw error(404, `Organization '${params.orgSlug}' not found`);
  }

  if (org.role !== 'Owner' && org.role !== 'Moderator') {
    throw error(403, 'Admin access requires Owner or Moderator role');
  }

  return {
    org,
    orgId: org.id as string,
    orgSlug: org.slug as string,
    orgRole: org.role as string,
  };
};
