import { describe, expect, it } from 'vitest';
import { parseActionSuccessKey } from './action-feedback';

const messages = {
  'role-updated': 'Role updated successfully',
  'member-removed': 'Member removed successfully',
} as const;

describe('parseActionSuccessKey', () => {
  it('accepts only own keys from the route message map', () => {
    expect(parseActionSuccessKey('role-updated', messages)).toBe(
      'role-updated'
    );
    expect(parseActionSuccessKey('Role updated successfully', messages)).toBe(
      undefined
    );
    expect(parseActionSuccessKey('toString', messages)).toBe(undefined);
  });
});
