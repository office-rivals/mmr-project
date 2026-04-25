import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClientV3 } }) => {
  let organizations: Array<{
    name: string;
    slug: string;
    leagues: Array<{ name: string; slug: string }>;
  }> = [];

  try {
    const me = await apiClientV3.meApi.getMe();
    organizations = (me.organizations ?? []).map((org) => ({
      name: org.name,
      slug: org.slug,
      leagues: (org.leagues ?? []).map((league) => ({
        name: league.name,
        slug: league.slug,
      })),
    }));
  } catch {
    return { organizations: [] };
  }

  // If the user has exactly one org with one league, go straight there
  if (organizations.length === 1 && organizations[0].leagues?.length === 1) {
    const org = organizations[0];
    const league = org.leagues[0];
    throw redirect(307, `/${org.slug}/${league.slug}`);
  }

  return { organizations };
};
