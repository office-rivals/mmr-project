import { createApiClient } from '$lib/server/api/apiClient';
import { createApiClientV3 } from '$lib/server/api/apiClientV3';
import { redirect, type Handle, type HandleFetch } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';
import { env } from '$env/dynamic/private';

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

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  if (request.url.startsWith(`${event.url.origin}/api/`)) {
    const apiUrl = request.url.replace(event.url.origin, env.API_BASE_PATH!);
    const { getToken } = event.locals.auth();
    const token = await getToken();
    request = new Request(apiUrl, request);
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return fetch(request);
};
