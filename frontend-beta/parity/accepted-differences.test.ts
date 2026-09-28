import { describe, expect, it } from 'vitest';
import {
  countAcceptedPixels,
  addedDialogCloseRegions,
  dialogCloseSelector,
  matchingIconRegions,
  type IconRegion,
} from './accepted-differences';

const icon: IconRegion = {
  selector: 'svg.lucide-trophy',
  x: 2,
  y: 2,
  width: 4,
  height: 4,
};

describe('accepted visual differences', () => {
  it('accepts an approved glyph only when its geometry matches', () => {
    expect(matchingIconRegions([icon], [{ ...icon }])).toEqual([icon]);
    for (const change of [{ x: 3 }, { y: 3 }, { width: 5 }, { height: 5 }]) {
      expect(matchingIconRegions([icon], [{ ...icon, ...change }])).toEqual([]);
    }
  });

  it('does not accept missing, additional or unapproved glyphs', () => {
    expect(matchingIconRegions([icon], [])).toEqual([]);
    expect(matchingIconRegions([icon], [icon, icon])).toEqual([]);
    const unknown = { ...icon, selector: 'svg.lucide-user' };
    expect(matchingIconRegions([unknown], [unknown])).toEqual([]);
  });

  it('counts only changed pixels wholly inside approved icon bounds', () => {
    const diff = new Uint8Array(8 * 8 * 4);
    for (const [x, y] of [
      [2, 2],
      [5, 5],
      [1, 2],
      [6, 5],
    ]) {
      diff.set([255, 0, 0, 255], (y * 8 + x) * 4);
    }
    diff.set([255, 255, 0, 255], (3 * 8 + 3) * 4);
    expect(countAcceptedPixels(diff, 8, [icon, icon])).toBe(2);
  });
});

it('permits the added accessible close control only within its small button bounds', () => {
  const close = {
    ...icon,
    selector: dialogCloseSelector,
    width: 16,
    height: 16,
  };
  expect(addedDialogCloseRegions([close])).toEqual([close]);
  expect(addedDialogCloseRegions([{ ...close, width: 200 }])).toEqual([]);
  expect(addedDialogCloseRegions([{ ...close, height: 0 }])).toEqual([]);
  expect(addedDialogCloseRegions([icon])).toEqual([]);
});
