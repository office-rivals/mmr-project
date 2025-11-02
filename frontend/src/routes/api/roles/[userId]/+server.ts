import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const userId = Number(params.userId);

  try {
    const apiClient = locals.apiClient;
    const userDetails = await apiClient.adminUsersApi.adminUsersGetUser({ userId });
    return json({ role: userDetails.role || 'User' });
  } catch {
    return json({ role: 'User' });
  }
};
