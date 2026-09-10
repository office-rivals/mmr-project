import type { ErrorComponentProps } from '@tanstack/react-router';
import { getHttpErrorStatus } from '@/lib/http-error';

export function HttpErrorView({ error }: ErrorComponentProps) {
  const status = getHttpErrorStatus(error);

  return (
    <>
      <h1>{status ?? 'Error'}</h1>
      <p>{error.message}</p>
    </>
  );
}
