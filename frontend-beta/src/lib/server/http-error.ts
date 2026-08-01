import { createMiddleware } from '@tanstack/react-start';
import { HttpError } from '@/lib/http-error';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * A minimal HTML document carrying a real status code, standing in for
 * SvelteKit's default error page (the Svelte app has no `+error.svelte`
 * anywhere either). The message must stay visible as plain text — e2e and
 * support workflows read it.
 */
export function httpErrorResponse(status: number, message: string): Response {
  const body = `<!DOCTYPE html><html lang="en" class="dark"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${status}</title><style>body{margin:0;display:flex;min-height:100vh;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;background:#0c0a09;color:#fafaf9;font-family:'Chakra Petch',sans-serif;text-align:center}h1{margin:0;font-size:2rem}p{margin:0;color:#a8a29e}</style></head><body><h1>${status}</h1><p>${escapeHtml(message)}</p></body></html>`;

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

/**
 * Turns a throw-on-failure check into a route `server.middleware`.
 *
 * Route server middleware is the only place a document response can carry an
 * arbitrary status: it runs before the router renders, and returning a
 * `Response` short-circuits the whole request. Attach it with
 * `server: { middleware: [guard] }` on the route (or layout route) that owns
 * the gate — it then covers every descendant document request, exactly like a
 * SvelteKit layout `load` that throws.
 *
 * It runs on the **server only**, so the matching route must repeat the check
 * in `beforeLoad` (throwing the same `HttpError`) for client-side navigations.
 */
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
