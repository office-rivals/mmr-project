import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
  locals: { apiClientV3 },
  fetch,
}) => {
  try {
    const response = await apiClientV3.personalAccessTokensApi.listTokens();
    return { tokens: response };
  } catch {
    return { tokens: [] };
  }
};

export const actions: Actions = {
  create: async ({ request, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const name = formData.get('name');
    const expiresAt = formData.get('expiresAt');

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return fail(400, { error: 'Token name is required' });
    }

    try {
      const result = await apiClientV3.personalAccessTokensApi.generateToken({
        name: name.trim(),
        scope: 'full',
        expiresAt:
          expiresAt && typeof expiresAt === 'string' && expiresAt !== ''
            ? new Date(expiresAt).toISOString()
            : undefined,
      });

      return { success: true, createdToken: result };
    } catch {
      return fail(500, { error: 'Failed to create token' });
    }
  },

  delete: async ({ request, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const tokenId = formData.get('tokenId');

    if (!tokenId || typeof tokenId !== 'string') {
      return fail(400, { error: 'Token ID is required' });
    }

    try {
      await apiClientV3.personalAccessTokensApi.revokeToken(tokenId);
      return { success: true, deleted: true };
    } catch {
      return fail(500, { error: 'Failed to revoke token' });
    }
  },
};
