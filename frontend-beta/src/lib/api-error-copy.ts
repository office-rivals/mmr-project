export const CONFLICT_COPY =
  'Someone else changed this while you were working. Reload and try again.';

/**
 * Rewrites the API failures #419 introduced in the app's voice. Anything else
 * keeps the API's message.
 */
export function describeApiFailure(status: number, message: string): string {
  if (status === 409) return CONFLICT_COPY;
  if (
    status === 400 &&
    /multiple organization members match this email/i.test(message)
  ) {
    return 'More than one member uses this email. Pick the member from the list instead.';
  }
  if (status === 400 && /slug '(claim|settings)' is reserved/i.test(message)) {
    return '"claim" and "settings" are reserved. Choose a different league slug.';
  }
  return message;
}
