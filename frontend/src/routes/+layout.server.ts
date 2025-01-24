import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { auth } }) => {
  const session = await auth();
  return {
    session,
  };
};
