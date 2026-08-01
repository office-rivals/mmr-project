import { createMiddleware } from '@tanstack/react-start';

/** Prefix match, not exact — Clerk's multi-step URLs live under these paths. */
const PUBLIC_PATH_PREFIXES = ['/login', '/sign-up'];

/**
 * SvelteKit's `handle` hook never sees requests for files in `static/`, which
 * are resolved before hooks run. Vite/Start have no such split, so asset-shaped
 * paths are exempted explicitly — otherwise a signed-out visitor's `/login`
 * would 303 away its own stylesheet and Clerk bundle.
 */
const isAssetRequest = (pathname: string) =>
  pathname.startsWith('/@') ||
  pathname.startsWith('/assets/') ||
  pathname.startsWith('/node_modules/') ||
  /\.[a-zA-Z0-9]+$/.test(pathname);

const redirect303 = (location: string) =>
  new Response(null, { status: 303, headers: { location } });

type ClerkRequestContext = {
  auth?: (
    opts?: unknown
  ) => Promise<{ userId: string | null }> | { userId: string | null };
};

/**
 * Port of `authGuard` in the SvelteKit app's `hooks.server.ts`. Runs as request
 * middleware (not per-route `beforeLoad`) so it covers server routes and server
 * function RPCs too. Deliberately preserves the original semantics: 303 in both
 * directions, prefix matching, and no return-URL preservation.
 *
 * The session comes from `clerkMiddleware()`'s middleware context, not from
 * `auth()`: `auth()` reads the global Start context, which only exists further
 * in (loaders, server functions, route handlers) — inside request middleware it
 * throws "No Start context found in AsyncLocalStorage".
 */
export const authGuardMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ pathname, next, context }) => {
    if (isAssetRequest(pathname)) return next();

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
