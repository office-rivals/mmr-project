export const CONFLICT_COPY =
  'Someone else changed this while you were working. Reload and try again.';

/**
 * Rewrites the API's conflict, ambiguous-email and reserved-slug failures in
 * the app's voice. Anything else keeps the API's message.
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

const DECIDED_COPY: Record<string, string> = {
  approved: 'A moderator already approved this claim request.',
  rejected: 'A moderator already turned down this claim request.',
  cancelled: 'This claim request was already cancelled.',
};

export interface ClaimFailure {
  message: string;
  /** The claim was decided elsewhere, so the page's copy of it is out of date. */
  stale: boolean;
}

/** Rewrites the claim API's failures in the app's voice. */
export function describeClaimFailure(message: string): ClaimFailure {
  const decided = /already decided as (\w+)/i.exec(message)?.[1];
  if (decided) {
    return {
      message:
        DECIDED_COPY[decided.toLowerCase()] ??
        'This claim request was already decided.',
      stale: true,
    };
  }
  if (/already has match activity/i.test(message)) {
    return {
      message:
        "You've already played here, so this account can't take over another player. Ask a moderator to merge them.",
      stale: false,
    };
  }
  return { message, stale: false };
}
