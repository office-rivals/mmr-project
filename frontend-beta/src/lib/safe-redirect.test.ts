import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('keeps same-origin paths with their query and hash', () => {
    expect(safeRedirectPath('/acme/foosball/tables/t1')).toBe(
      '/acme/foosball/tables/t1'
    );
    expect(safeRedirectPath('/a/b?x=1#top')).toBe('/a/b?x=1#top');
  });

  it.each([
    'https://evil.example/',
    'javascript:alert(1)',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    ' /x',
    'evil.example',
    '',
  ])('rejects %j', (value) => {
    expect(safeRedirectPath(value)).toBe('/');
  });

  it('rejects non-strings and auth pages (no redirect loops)', () => {
    expect(safeRedirectPath(undefined)).toBe('/');
    expect(safeRedirectPath(['/a'])).toBe('/');
    expect(safeRedirectPath('/login')).toBe('/');
    expect(safeRedirectPath('/sign-up/verify')).toBe('/');
  });
});
