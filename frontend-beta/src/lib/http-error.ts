/**
 * The React equivalent of SvelteKit's `error(status, message)`.
 *
 * Two halves, because TanStack Router derives the SSR document status from its
 * own `statusCode` store (200 / 404 / 500 / redirect) and offers no hook for an
 * arbitrary code:
 *
 *  - On a **document** request the status comes from a route-level
 *    `server.middleware` guard (`createRouteGuard` in `lib/server/http-error`),
 *    which short-circuits with a real `Response` before the router renders.
 *  - On a **client** navigation there is no document, so the route's
 *    `beforeLoad` throws this error and the route's `errorComponent`
 *    (`HttpErrorView`) renders the same message.
 *
 * Both halves must agree on the status and the message string — the messages
 * are part of the parity contract.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Reads the status off an error that may have crossed the SSR boundary, where
 * `instanceof` no longer holds because the value was re-created from its
 * serialized form.
 */
export function getHttpErrorStatus(error: unknown): number | null {
  if (error instanceof HttpError) return error.status;
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }
  return null;
}
