import { createMiddleware } from '@tanstack/react-start';

import { isPublicAssetPath } from '../public-assets';

const PUBLIC_PATH_PREFIXES = ['/login', '/sign-up'];

const redirect303 = (location: string) =>
  new Response(null, { status: 303, headers: { location } });

type ClerkRequestContext = {
  auth?: (
    opts?: unknown
  ) => Promise<{ userId: string | null }> | { userId: string | null };
};

// Clerk's request context exists before Start's loader context is available.
export const authGuardMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ pathname, next, context }) => {
    if (isPublicAssetPath(pathname)) return next();

    const getAuth = (context as unknown as ClerkRequestContext | undefined)
      ?.auth;
    const { userId } = getAuth ? await getAuth() : { userId: null };

    const isNonAuthedPathname = PUBLIC_PATH_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );

    if (!userId && !isNonAuthedPathname) return redirect303('/login');
    if (userId && isNonAuthedPathname) return redirect303('/');

    return next();
  }
);
