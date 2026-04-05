export async function getApiErrorDetails(
  error: unknown,
  fallbackMessage: string
) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response: Response }).response;

    try {
      const body = await response.json();
      if (
        body &&
        typeof body === 'object' &&
        'detail' in body &&
        typeof body.detail === 'string'
      ) {
        return {
          status: response.status,
          message: body.detail,
        };
      }
    } catch {
      try {
        const text = await response.text();
        if (text) {
          return {
            status: response.status,
            message: text,
          };
        }
      } catch {
      }
    }

    return {
      status: response.status,
      message: fallbackMessage,
    };
  }

  return {
    status: 500,
    message: fallbackMessage,
  };
}
