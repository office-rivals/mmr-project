import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

import {
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_SUPABASE_URL,
} from '$env/static/public';
import { createApiClient } from '$lib/server/api/apiClient';

const supabase: Handle = async ({ event, resolve }) => {
  /**
   * Creates a Supabase client specific to this server request.
   *
   * The Supabase client gets the Auth token from the request cookies.
   */
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (key) => event.cookies.get(key),
        /**
         * SvelteKit's cookies API requires `path` to be explicitly set in
         * the cookie options. Setting `path` to `/` replicates previous/
         * standard behavior.
         */
        set: (key, value, options) => {
          event.cookies.set(key, value, { ...options, path: '/' });
        },
        remove: (key, options) => {
          event.cookies.delete(key, { ...options, path: '/' });
        },
      },
    }
  );

  /**
   * Unlike `supabase.auth.getSession()`, which returns the session _without_
   * validating the JWT, this function also calls `getUser()` to validate the
   * JWT before returning the session.
   */
  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession();
    if (!session) {
      return { session: null };
    }

    // const { error } = await event.locals.supabase.auth.getUser();
    // if (error) {
    //   // JWT validation has failed
    //   return { session: null };
    // }

    return { session };
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      /**
       * Supabase libraries use the `content-range` and `x-supabase-api-version`
       * headers, so we need to tell SvelteKit to pass it through.
       */
      return name === 'content-range' || name === 'x-supabase-api-version';
    },
  });
};

const authGuard: Handle = async ({ event, resolve }) => {
  const { session } = await event.locals.safeGetSession();
  event.locals.session = session;

  const isNonAuthedPathname =
    event.url.pathname.startsWith('/auth') ||
    event.url.pathname.startsWith('/login') ||
    event.url.pathname.startsWith('/signup');
  if (!event.locals.session && !isNonAuthedPathname) {
    return redirect(303, '/login');
  }

  if (event.locals.session && isNonAuthedPathname) {
    return redirect(303, '/');
  }

  return resolve(event);
};

const apiCliented: Handle = async ({ event, resolve }) => {
  if (event.locals.session != null) {
    event.locals.apiClient = createApiClient(event.locals.session.access_token);
  }

  return resolve(event);
};

export const handle: Handle = sequence(supabase, authGuard, apiCliented);
