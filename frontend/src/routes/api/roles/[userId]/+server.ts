import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const userId = Number(params.userId);

  try {
    const apiClient = locals.apiClient;
    const roleResponse = await apiClient.rolesApi.rolesGetPlayerRole({ playerId: userId });
    return json({ role: roleResponse.role || 'User' });
  } catch {
    return json({ role: 'User' });
  }
};
