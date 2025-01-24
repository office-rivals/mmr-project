import { createApiClient } from '$lib/server/api/apiClient';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';

const authGuard: Handle = async ({ event, resolve }) => {
  const session = await event.locals.auth();

  event.locals.session = session;
  const isNonAuthedPathname =
    event.url.pathname.startsWith('/auth') ||
    event.url.pathname.startsWith('/signin') ||
    event.url.pathname.startsWith('/signup');
  if (!event.locals.session && !isNonAuthedPathname) {
    return redirect(303, '/signin');
  }

  if (event.locals.session && isNonAuthedPathname) {
    return redirect(303, '/');
  }

  return resolve(event);
};

const apiCliented: Handle = async ({ event, resolve }) => {
  if (event.locals.session?.accessToken != null) {
    event.locals.apiClient = createApiClient(event.locals.session.accessToken);
  }

  return resolve(event);
};

export const handle: Handle = sequence(authHandle, authGuard, apiCliented);
