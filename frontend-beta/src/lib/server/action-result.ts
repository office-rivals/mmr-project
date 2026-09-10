import {
  getResponseStatus,
  setResponseStatus,
} from '@tanstack/react-start/server';
import { httpErrorResponse } from './http-error';

export function failServerAction<T>(status: number, result: T): T {
  setResponseStatus(status);
  return result;
}

export function parseNativeFormData(request: Request): Promise<FormData> {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new Response('Forbidden', { status: 403 });
  }
  return request.formData();
}

export function nativeFormResponse(
  request: Request,
  result: { success?: string | boolean; error?: string; message?: string }
): Response {
  if (result.error || result.success === false) {
    const message = result.error ?? result.message ?? 'Request failed';
    const status = getResponseStatus();
    return httpErrorResponse(status >= 400 ? status : 500, message);
  }

  const location = new URL(request.url);
  location.searchParams.delete('actionError');
  location.searchParams.delete('actionSuccess');
  const successMessage =
    typeof result.success === 'string' ? result.success : result.message;
  if (successMessage) {
    location.searchParams.set('actionSuccess', successMessage);
  }
  return new Response(null, {
    status: 303,
    headers: { location: `${location.pathname}${location.search}` },
  });
}
