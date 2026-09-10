import { describe, expect, it } from 'vitest';
import { moveHighlight, resolveEnterTarget } from './combobox';

const OPTIONS = ['league:a', 'league:b', 'member:c'];

const submit = (over: Partial<Parameters<typeof resolveEnterTarget>[0]>) =>
  resolveEnterTarget({
    options: OPTIONS,
    highlighted: null,
    arrowed: false,
    filterLength: 0,
    requireArrow: true,
    minFilterLength: 2,
    ...over,
  });

describe('resolveEnterTarget — submit slot', () => {
  it('ignores an untouched list of recents', () => {
    expect(submit({})).toBeUndefined();
  });

  it('ignores a highlight the user did not arrow to', () => {
    expect(submit({ highlighted: 'league:b' })).toBeUndefined();
  });

  it('picks an arrowed-to highlight even with an empty filter', () => {
    expect(submit({ highlighted: 'league:b', arrowed: true })).toBe('league:b');
  });

  it('ignores a highlight that is no longer in the list', () => {
    expect(
      submit({ highlighted: 'league:gone', arrowed: true, filterLength: 4 })
    ).toBe('league:a');
  });

  it('picks the top match once the filter is longer than one character', () => {
    expect(submit({ filterLength: 2 })).toBe('league:a');
  });

  it('does nothing at a single character', () => {
    expect(submit({ filterLength: 1 })).toBeUndefined();
  });

  it('does nothing when nothing matched', () => {
    expect(submit({ options: [], filterLength: 9 })).toBeUndefined();
  });
});

describe('resolveEnterTarget — profile filter', () => {
  const filterPicker = (
    over: Partial<Parameters<typeof resolveEnterTarget>[0]>
  ) =>
    resolveEnterTarget({
      options: OPTIONS,
      highlighted: null,
      arrowed: false,
      filterLength: 4,
      requireArrow: false,
      minFilterLength: 2,
      ...over,
    });

  it('picks a highlight without requiring an arrow press', () => {
    expect(filterPicker({ highlighted: 'member:c' })).toBe('member:c');
  });

  it('falls back to the top match', () => {
    expect(filterPicker({})).toBe('league:a');
  });
});

describe('moveHighlight', () => {
  it('starts at the first option going down and the last going up', () => {
    expect(moveHighlight(OPTIONS, null, 'down')).toBe('league:a');
    expect(moveHighlight(OPTIONS, null, 'up')).toBe('member:c');
  });

  it('steps and wraps in both directions', () => {
    expect(moveHighlight(OPTIONS, 'league:a', 'down')).toBe('league:b');
    expect(moveHighlight(OPTIONS, 'member:c', 'down')).toBe('league:a');
    expect(moveHighlight(OPTIONS, 'league:a', 'up')).toBe('member:c');
  });

  it('restarts from the ends when the highlight has fallen out of the list', () => {
    expect(moveHighlight(OPTIONS, 'league:gone', 'down')).toBe('league:a');
    expect(moveHighlight(OPTIONS, 'league:gone', 'up')).toBe('member:c');
  });

  it('has nothing to highlight in an empty list', () => {
    expect(moveHighlight([], null, 'down')).toBeNull();
  });
});
