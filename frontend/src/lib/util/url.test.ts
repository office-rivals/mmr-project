import { describe, it, expect } from 'vitest';
import { withSeasonParam } from './url';

describe('withSeasonParam', () => {
  it('appends ?season=<id> when path has no query string', () => {
    expect(withSeasonParam('/x', 5)).toBe('/x?season=5');
  });

  it('appends &season=<id> when path already has a query string', () => {
    expect(withSeasonParam('/x?a=1', 5)).toBe('/x?a=1&season=5');
  });

  it('returns path unchanged when seasonId is undefined', () => {
    expect(withSeasonParam('/x')).toBe('/x');
  });

  it('returns path unchanged when seasonId is 0 (falsy)', () => {
    expect(withSeasonParam('/x', 0)).toBe('/x');
  });

  it('works with a string seasonId', () => {
    expect(withSeasonParam('/matches', 'spring-2026')).toBe(
      '/matches?season=spring-2026'
    );
  });
});
