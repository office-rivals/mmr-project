import { createApiClient } from '$lib/server/api/apiClient';
import { createApiClientV3 } from '$lib/server/api/apiClientV3';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';

const authGuard: Handle = async ({ event, resolve }) => {
  const { userId } = event.locals.auth();

  const isNonAuthedPathname = event.url.pathname.startsWith('/login');
  if (!userId && !isNonAuthedPathname) {
    return redirect(303, '/login');
  }

  if (userId && isNonAuthedPathname) {
    return redirect(303, '/');
  }

  return resolve(event);
};

const apiCliented: Handle = async ({ event, resolve }) => {
  const { userId, getToken } = event.locals.auth();
  if (userId) {
    event.locals.apiClient = createApiClient(getToken);
    event.locals.apiClientV3 = createApiClientV3(getToken);
  }

  return resolve(event);
};

export const handle: Handle = sequence(
  withClerkHandler(),
  authGuard,
  apiCliented
);
