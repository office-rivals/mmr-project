import { describe, expect, it } from 'vitest';
import { clerkAuthorizedParties } from './clerk-options';

describe('Clerk authorized parties', () => {
  it('allows explicitly configured primary and beta origins', () => {
    expect(
      clerkAuthorizedParties(
        'https://app.example.com/, https://beta.app.example.com'
      )
    ).toEqual(['https://app.example.com', 'https://beta.app.example.com']);
    expect(clerkAuthorizedParties(undefined)).toBeUndefined();
  });

  it('rejects malformed and non-origin allowlist entries', () => {
    for (const value of [
      '*',
      'https://app.example.com,',
      'ftp://app.example.com',
      'https://user@app.example.com',
      'https://app.example.com/login',
    ]) {
      expect(() => clerkAuthorizedParties(value)).toThrow();
    }
  });
});
