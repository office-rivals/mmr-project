import type { ErrorComponentProps } from '@tanstack/react-router';
import { getHttpErrorStatus } from '@/lib/http-error';

/**
 * Client-navigation counterpart to `httpErrorResponse`. A document request is
 * already answered by the route's `server.middleware` guard with a real status
 * code, so this only ever renders after an in-app navigation — where there is
 * no response to give a status to, but the message still has to be visible.
 */
export function HttpErrorView({ error }: ErrorComponentProps) {
  const status = getHttpErrorStatus(error);

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <h1 className="text-3xl font-bold">{status ?? 'Error'}</h1>
      <p className="text-muted-foreground">{error.message}</p>
    </div>
  );
}
