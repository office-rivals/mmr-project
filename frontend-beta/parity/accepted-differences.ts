export const acceptedIconSelectors = [
  'svg.lucide-trophy',
  'svg.lucide-calendar-days',
  'svg.lucide-circle-check',
  'svg.lucide-swords',
] as const;

export const dialogCloseSelector = '[role="dialog"] button[data-dialog-close]';

export const legacyDialogCloseSelector =
  '[role="dialog"] + button[data-dialog-close]';

export interface VisualRegion {
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function matchingVisualRegions(
  reference: VisualRegion[],
  beta: VisualRegion[]
): VisualRegion[] {
  return acceptedIconSelectors.flatMap((selector) => {
    const before = reference.filter((region) => region.selector === selector);
    const after = beta.filter((region) => region.selector === selector);
    if (before.length !== after.length) return [];
    return before.filter((region, index) => {
      const other = after[index];
      return (
        region.width > 0 &&
        region.height > 0 &&
        region.x === other.x &&
        region.y === other.y &&
        region.width === other.width &&
        region.height === other.height
      );
    });
  });
}

export function countAcceptedPixels(
  diff: Uint8Array,
  width: number,
  regions: VisualRegion[]
): number {
  let count = 0;
  for (let offset = 0; offset < diff.length; offset += 4) {
    // Pixelmatch paints changed pixels red; unchanged/antialiased pixels are not red.
    if (
      diff[offset] !== 255 ||
      diff[offset + 1] !== 0 ||
      diff[offset + 2] !== 0 ||
      diff[offset + 3] !== 255
    )
      continue;
    const pixel = offset / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (
      regions.some(
        (region) =>
          x >= region.x &&
          x + 1 <= region.x + region.width &&
          y >= region.y &&
          y + 1 <= region.y + region.height
      )
    )
      count++;
  }
  return count;
}

function smallCloseRegions(
  regions: VisualRegion[],
  selector: string
): VisualRegion[] {
  return regions.filter(
    (region) =>
      region.selector === selector &&
      region.width > 0 &&
      region.width <= 24 &&
      region.height > 0 &&
      region.height <= 24
  );
}

export function addedDialogCloseRegions(beta: VisualRegion[]): VisualRegion[] {
  return smallCloseRegions(beta, dialogCloseSelector);
}

export function removedDialogCloseRegions(
  reference: VisualRegion[]
): VisualRegion[] {
  return smallCloseRegions(reference, legacyDialogCloseSelector);
}
