import { ResponseError } from '$api';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClient } }) => {
  try {
    const tokens =
      await apiClient.personalAccessTokensApi.personalAccessTokensListTokens();
    return { tokens };
  } catch (error) {
    console.error('Failed to load personal access tokens:', error);
    return { tokens: [] };
  }
};

export const actions: Actions = {
  create: async ({ request, locals: { apiClient } }) => {
    const formData = await request.formData();
    const name = formData.get('name');
    const expiresAt = formData.get('expiresAt');

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return fail(400, { error: 'Token name is required' });
    }

    try {
      const result = await apiClient.personalAccessTokensApi.personalAccessTokensCreateToken({
        createPersonalAccessTokenRequest: {
          name: name.trim(),
          expiresAt: expiresAt && typeof expiresAt === 'string' && expiresAt !== ''
            ? new Date(expiresAt)
            : undefined,
        },
      });

      return { success: true, createdToken: result };
    } catch (error) {
      console.error('Failed to create token:', error);
      if (error instanceof ResponseError) {
        return fail(500, { error: 'Failed to create token' });
      }
      return fail(500, { error: 'An unexpected error occurred' });
    }
  },

  delete: async ({ request, locals: { apiClient } }) => {
    const formData = await request.formData();
    const tokenId = formData.get('tokenId');

    if (!tokenId || typeof tokenId !== 'string') {
      return fail(400, { error: 'Token ID is required' });
    }

    const tokenIdNum = Number(tokenId);
    if (isNaN(tokenIdNum)) {
      return fail(400, { error: 'Invalid token ID' });
    }

    try {
      await apiClient.personalAccessTokensApi.personalAccessTokensRevokeToken({
        tokenId: tokenIdNum,
      });

      return { success: true, deleted: true };
    } catch (error) {
      console.error('Failed to delete token:', error);
      if (error instanceof ResponseError) {
        return fail(500, { error: 'Failed to revoke token' });
      }
      return fail(500, { error: 'An unexpected error occurred' });
    }
  },
};
