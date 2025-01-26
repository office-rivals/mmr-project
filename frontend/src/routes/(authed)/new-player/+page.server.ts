import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate, type ErrorStatus } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { ResponseError } from '../../../api';
import type { Actions, PageServerLoad } from './$types';
import { createPlayerSchema } from './schema';

export const load: PageServerLoad = async ({ url }) => {
  const name = url.searchParams.get('name') ?? '';

  return {
    form: await superValidate(zod(createPlayerSchema), { defaults: { name } }),
  };
};

export const actions: Actions = {
  default: async (event) => {
    const apiClient = event.locals.apiClient;
    const form = await superValidate(event, zod(createPlayerSchema));

    const redirectTo = event.url.searchParams.get('redirect_to');

    if (!form.valid) {
      return fail(400, {
        form,
      });
    }

    let userId;

    try {
      const user = await apiClient.usersApi.usersCreateUser({
        createUserRequest: form.data,
      });
      userId = user.userId;
    } catch (error) {
      if (error instanceof ResponseError) {
        const errorResponse = await error.response.json();
        return message(form, errorResponse.error, {
          status: error.response.status as ErrorStatus,
        });
      }
      return fail(500, {
        form,
      });
    }

    redirect(303, redirectTo != null ? redirectTo + userId : '/');
  },
};
