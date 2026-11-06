// Document guards set the HTTP status; client route boundaries render this error.
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Serialized errors can cross the SSR boundary without their prototype.
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
