import { createMiddleware } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';

import { isPublicAssetPath } from '../public-assets';
import { safeRedirectPath } from '../safe-redirect';

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
  async ({ pathname, request, next, context }) => {
    if (isPublicAssetPath(pathname)) return next();

    const getAuth = (context as unknown as ClerkRequestContext | undefined)
      ?.auth;
    const { userId } = getAuth ? await getAuth() : { userId: null };

    const isNonAuthedPathname = PUBLIC_PATH_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );

    if (!userId && !isNonAuthedPathname) {
      // Bring the user back after sign-in, e.g. from a table's QR/NFC link.
      const { search } = new URL(request.url);
      const target = safeRedirectPath(`${pathname}${search}`);
      return redirect303(
        target === '/'
          ? '/login'
          : `/login?redirect_url=${encodeURIComponent(target)}`
      );
    }
    if (userId && isNonAuthedPathname) {
      const target = new URL(request.url).searchParams.get('redirect_url');
      return redirect303(safeRedirectPath(target));
    }

    return next();
  }
);
