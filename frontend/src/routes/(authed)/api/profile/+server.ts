
import { redirect } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals: { apiClient } }) => {
  const { userId } = await apiClient.profileApi.profileGetProfile();

  if (userId != null) {
    redirect(303, `/api/profile/${userId}`);
  }

  return {};
};
