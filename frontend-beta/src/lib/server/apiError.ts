export async function getApiErrorDetails(
  error: unknown,
  fallbackMessage: string
): Promise<{ status: number; message: string }> {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response: Response }).response;
    // Preserve the body for non-JSON error responses.
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

/**
 * A failed form action as both copies it needs. Native error documents render
 * the fixed `error`, because API details can echo submitted fields such as an
 * invited email; the page shows `detail`, so a conflict can say to reload.
 */
export async function getFormActionFailure(
  error: unknown,
  fallbackMessage: string
): Promise<{ status: number; error: string; detail: string }> {
  const { status, message } = await getApiErrorDetails(error, fallbackMessage);
  return { status, error: fallbackMessage, detail: message };
}
