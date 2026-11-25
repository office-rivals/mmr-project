import { describe, it, expect } from 'vitest';
import { isPresent, isDefined, isNotNull } from './isPresent';

describe('isPresent', () => {
  it('returns false for null', () => {
    expect(isPresent(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPresent(undefined)).toBe(false);
  });

  it('returns true for 0 (falsy but present)', () => {
    expect(isPresent(0)).toBe(true);
  });

  it('returns true for empty string (falsy but present)', () => {
    expect(isPresent('')).toBe(true);
  });

  it('returns true for false (falsy but present)', () => {
    expect(isPresent(false)).toBe(true);
  });

  it('returns true for a truthy value', () => {
    expect(isPresent('hello')).toBe(true);
  });
});

describe('isDefined', () => {
  it('returns false for undefined', () => {
    expect(isDefined(undefined)).toBe(false);
  });

  it('returns true for null (null is defined)', () => {
    expect(isDefined(null)).toBe(true);
  });

  it('returns true for a value', () => {
    expect(isDefined(42)).toBe(true);
  });
});

describe('isNotNull', () => {
  it('returns false for null', () => {
    expect(isNotNull(null)).toBe(false);
  });

  it('returns true for undefined (undefined is not null)', () => {
    expect(isNotNull(undefined)).toBe(true);
  });

  it('returns true for a value', () => {
    expect(isNotNull('x')).toBe(true);
  });
});
