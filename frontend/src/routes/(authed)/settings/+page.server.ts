import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClientV3 } }) => {
  const [tokens, tags] = await Promise.all([
    apiClientV3.personalAccessTokensApi.listTokens().catch(() => []),
    apiClientV3.pairingApi.listTags().catch(() => []),
  ]);

  return { tokens, tags };
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
        scope: 'write',
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

  issuePairingCode: async ({ locals: { apiClientV3 } }) => {
    try {
      const pairingCode = await apiClientV3.pairingApi.issuePairingCode();
      return { pairingCode };
    } catch {
      return fail(500, { pairingError: 'Failed to generate pairing code' });
    }
  },

  unlinkTag: async ({ request, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const tagId = formData.get('tagId');

    if (!tagId || typeof tagId !== 'string') {
      return fail(400, { pairingError: 'Tag ID is required' });
    }

    try {
      await apiClientV3.pairingApi.unlinkTag(tagId);
      return { unlinkedTag: true };
    } catch {
      return fail(500, { pairingError: 'Failed to unlink RFID tag' });
    }
  },
};
