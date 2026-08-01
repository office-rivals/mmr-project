/**
 * Server-only port of `frontend/src/lib/server/api/apiError.ts`.
 *
 * The generated client throws a `ResponseError` carrying the raw `Response`.
 * ASP.NET returns ProblemDetails, so `body.detail` is the human message; a
 * non-JSON body falls back to the raw text, and a non-HTTP failure to the
 * caller's fallback string with status 500. The response is cloned up front
 * because a body can only be consumed once.
 */
export async function getApiErrorDetails(
  error: unknown,
  fallbackMessage: string
): Promise<{ status: number; message: string }> {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response: Response }).response;
    const responseForTextFallback = response.clone();

    try {
      const body = await response.json();
      if (
        body &&
        typeof body === 'object' &&
        'detail' in body &&
        typeof body.detail === 'string'
      ) {
        return { status: response.status, message: body.detail };
      }
    } catch {
      try {
        const text = await responseForTextFallback.text();
        if (text) {
          return { status: response.status, message: text };
        }
      } catch {
        // ignore — fall through to the fallback
      }
    }

    return { status: response.status, message: fallbackMessage };
  }

  return { status: 500, message: fallbackMessage };
}
