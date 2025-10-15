import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  const { userId } = locals.auth();

  if (!userId) {
    return redirect(307, '/login');
  }

  return {
    userId,
  };
};
