import { describe, expect, it } from 'vitest';
import { formatVolts, relativeParts } from './format';

describe('relativeParts', () => {
  it('picks the largest whole unit', () => {
    expect(relativeParts(5_000)).toEqual([-5, 'second']);
    expect(relativeParts(90 * 60_000)).toEqual([-1, 'hour']);
    expect(relativeParts(3 * 86_400_000)).toEqual([-3, 'day']);
  });

  it('treats clock skew into the future as now', () => {
    expect(relativeParts(-10_000)).toEqual([-0, 'second']);
  });
});

it('formats millivolts', () => {
  expect(formatVolts(4410)).toBe('4.41 V');
  expect(formatVolts(null)).toBe('—');
});
