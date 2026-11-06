import { describe, expect, it } from 'vitest';
import { streakGlyph } from './streak';

describe('streakGlyph', () => {
  it.each([
    [3, '🔥'],
    [6, '🔥'],
    [7, '🚀'],
    [10, '🚀'],
    [11, '🐐'],
    [40, '🐐'],
  ])('%i wins in a row is %s', (length, glyph) => {
    expect(streakGlyph(true, length)).toBe(glyph);
  });

  it.each([
    [3, '🌧️'],
    [4, '🌧️'],
    [5, '⛈️'],
    [6, '⛈️'],
    [7, '❄️'],
    [9, '❄️'],
    [10, '☃️'],
    [12, '☃️'],
    [13, '🪦'],
    [40, '🪦'],
  ])('%i losses in a row is %s', (length, glyph) => {
    expect(streakGlyph(false, length)).toBe(glyph);
  });
});
