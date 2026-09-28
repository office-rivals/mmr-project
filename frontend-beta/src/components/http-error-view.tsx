import type { ErrorComponentProps } from '@tanstack/react-router';
import { getHttpErrorStatus } from '@/lib/http-error';

export function HttpErrorView({ error }: ErrorComponentProps) {
  const status = getHttpErrorStatus(error);
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : 'An unexpected error occurred.';

  return (
    <>
      <h1>{status ?? 'Error'}</h1>
      <p>{message}</p>
    </>
  );
}
