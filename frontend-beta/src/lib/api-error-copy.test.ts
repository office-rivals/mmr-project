import { describe, expect, it } from 'vitest';
import {
  CONFLICT_COPY,
  describeApiFailure,
  describeClaimFailure,
} from './api-error-copy';

describe('describeApiFailure', () => {
  it.each([
    'The request conflicted with another update. Reload and retry.',
    'A player changed while the match was being saved. Reload and retry.',
    'This claim request was already decided as Rejected.',
  ])('turns a conflict into one instruction to reload: %s', (message) => {
    expect(describeApiFailure(409, message)).toBe(CONFLICT_COPY);
  });

  it('explains an email that matches several members', () => {
    expect(
      describeApiFailure(
        400,
        'Multiple organization members match this email. Select an existing player instead.'
      )
    ).toBe(
      'More than one member uses this email. Pick the member from the list instead.'
    );
  });

  it.each(['claim', 'settings', 'Claim'])(
    'explains the league slugs the organization routes reserve: %s',
    (slug) => {
      expect(
        describeApiFailure(
          400,
          `The slug '${slug}' is reserved and cannot be used`
        )
      ).toBe(
        '"claim" and "settings" are reserved. Choose a different league slug.'
      );
    }
  );

  it('keeps every other message, including other reserved slugs', () => {
    expect(
      describeApiFailure(
        400,
        "The slug 'submit' is reserved and cannot be used"
      )
    ).toBe("The slug 'submit' is reserved and cannot be used");
    expect(describeApiFailure(403, 'Only owners can change roles')).toBe(
      'Only owners can change roles'
    );
  });
});

describe('describeClaimFailure', () => {
  it.each([
    ['Approved', 'A moderator already approved this claim request.'],
    ['Rejected', 'A moderator already turned down this claim request.'],
    ['Cancelled', 'This claim request was already cancelled.'],
  ])(
    'says who decided a claim first, and marks it stale: %s',
    (status, copy) => {
      expect(
        describeClaimFailure(
          `This claim request was already decided as ${status}.`
        )
      ).toEqual({ message: copy, stale: true });
    }
  );

  it('explains why an account with matches cannot claim', () => {
    expect(
      describeClaimFailure(
        'This account already has match activity; ask about a merge instead.'
      )
    ).toEqual({
      message:
        "You've already played here, so this account can't take over another player. Ask a moderator to merge them.",
      stale: false,
    });
  });

  it('keeps every other message', () => {
    expect(describeClaimFailure('This player is no longer claimable.')).toEqual(
      { message: 'This player is no longer claimable.', stale: false }
    );
  });
});
