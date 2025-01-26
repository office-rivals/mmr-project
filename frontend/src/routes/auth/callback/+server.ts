import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(303, `/${next.slice(1)}`);
    }
  }
  // return the user to an error page with instructions
  // TODO: Create a page for this
  redirect(303, '/auth/auth-code-error');
};
