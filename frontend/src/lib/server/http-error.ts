import { createMiddleware } from '@tanstack/react-start';
import { HttpError } from '@/lib/http-error';
import appCss from '../../app.css?url';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function httpErrorResponse(status: number, message: string): Response {
  const body = `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${status}</title><link rel="stylesheet" href="${escapeHtml(appCss)}" /></head><body><h1>${status}</h1><p>${escapeHtml(message)}</p></body></html>`;

  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export interface RouteGuardContext {
  params: Record<string, string>;
  pathname: string;
  request: Request;
}

// Guards set document status before the router renders; client navigation uses HttpErrorView.
export function createRouteGuard(
  guard: (ctx: RouteGuardContext) => Promise<void> | void
) {
  return createMiddleware({ type: 'request' }).server(async (ctx) => {
    // `params` is supplied at runtime by the server-route middleware chain but
    // is not part of the request-middleware type.
    const params =
      (ctx as unknown as { params?: Record<string, string> }).params ?? {};

    try {
      await guard({ params, pathname: ctx.pathname, request: ctx.request });
    } catch (error) {
      if (error instanceof HttpError) {
        return httpErrorResponse(error.status, error.message);
      }
      throw error;
    }

    return ctx.next();
  });
}
