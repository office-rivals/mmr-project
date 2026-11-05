import { createMiddleware } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { getRequest } from '@tanstack/react-start/server';

import { safeInviteReturnPath } from '../game-invite';
import { isPublicAssetPath } from '../public-assets';

const PUBLIC_PATH_PREFIXES = ['/login', '/sign-up'];

const redirect303 = (location: string) =>
  redirect({ href: location, statusCode: 303 });

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

    if (!userId && !isNonAuthedPathname) {
      // A shared invite link returns the visitor to itself after sign-in.
      const returnTo = safeInviteReturnPath(pathname);
      return redirect303(
        returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'
      );
    }
    if (userId && isNonAuthedPathname) {
      const returnTo = safeInviteReturnPath(
        new URL(getRequest().url).searchParams.get('returnTo')
      );
      return redirect303(returnTo ?? '/');
    }

    return next();
  }
);
