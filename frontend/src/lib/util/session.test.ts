import { describe, it, expect } from 'vitest';
import { getRandomTeamsSessionStorageKey } from './session';

describe('getRandomTeamsSessionStorageKey', () => {
  it('produces the same key regardless of input order', () => {
    expect(getRandomTeamsSessionStorageKey(['b', 'a'])).toBe(
      getRandomTeamsSessionStorageKey(['a', 'b'])
    );
  });

  it('joins sorted players with "+"', () => {
    expect(getRandomTeamsSessionStorageKey(['charlie', 'alice', 'bob'])).toBe(
      'alice+bob+charlie'
    );
  });

  it('handles a single player', () => {
    expect(getRandomTeamsSessionStorageKey(['solo'])).toBe('solo');
  });
});
