import { ResponseError } from '$api';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClient } }) => {
  return {
    users: await apiClient.usersApi.usersGetUsers(),
  };
};

export const actions = {
  default: async (event) => {
    const apiClient = event.locals.apiClient;
    const formData = await event.request.formData();

    const userIdValue = formData.get('userId');

    if (userIdValue == null) {
      return fail(400);
    }

    const userId = Number(userIdValue);
    if (isNaN(userId)) {
      return fail(400);
    }

    try {
      await apiClient.profileApi.profileClaimProfile({
        claimProfileRequest: { userId },
      });
    } catch (error) {
      if (error instanceof ResponseError) {
        console.log(error);
        return fail(500);
      }
      return fail(500);
    }

    return redirect(303, `/player/${userId}`);
  },
};
