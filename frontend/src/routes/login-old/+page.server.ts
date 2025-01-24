import { redirect } from '@sveltejs/kit';

import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { loginSchema } from './schema';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(loginSchema));
  return { form };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event, zod(loginSchema));

    if (!form.valid) {
      return fail(400, {
        form,
      });
    }

    const { error } = await event.locals.supabase.auth.signInWithPassword(
      form.data
    );
    if (error) {
      console.error(error);
      return message(form, 'Invalid credentials', { status: 400 });
    } else {
      return redirect(303, '/');
    }
  },
};
