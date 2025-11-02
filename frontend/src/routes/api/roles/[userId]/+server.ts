import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const rawUserId = params.userId;
  if (!rawUserId) {
    throw error(400, 'Missing user id');
  }

  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId < 1) {
    throw error(400, 'Invalid user id');
  }

  try {
    const apiClient = locals.apiClient;
    const userDetails = await apiClient.adminUsersApi.adminUsersGetUser({ userId });
    return json({ role: userDetails.role ?? 'User' });
  } catch (err) {
    throw error(502, 'Failed to load player role');
  }
};
