import type { VisualRegion } from './accepted-differences';

export function collectVisualRegions(selectors: string[]): VisualRegion[] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context)
    throw new Error('Canvas is required to compare rendered colors');

  const paint = (color: string) => {
    if (color === 'none') return color;
    // Tailwind versions serialize equivalent colors as RGBA and OKLab.
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data).join(',');
  };

  return selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector)).map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      let opacity = 1;
      let ancestor: Element | null = element;
      while (ancestor) {
        opacity *= Number(getComputedStyle(ancestor).opacity);
        ancestor = ancestor.parentElement;
      }
      const occluded = Array.from(
        document.querySelectorAll(
          '[role="dialog"], [role="menu"], [role="listbox"], header, nav'
        )
      ).some((popup) => {
        if (popup.contains(element)) return false;
        if (
          popup.matches('header, nav') &&
          !['fixed', 'sticky'].includes(getComputedStyle(popup).position)
        )
          return false;
        const box = popup.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.height > 0 &&
          box.left < x + width &&
          box.right > x &&
          box.top < y + height &&
          box.bottom > y
        );
      });
      return {
        selector,
        x: x + window.scrollX,
        y: y + window.scrollY,
        width,
        height,
        visible: element.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        }),
        occluded,
        rawPaint: {
          color: style.color,
          stroke: style.stroke,
          fill: style.fill,
        },
        appearance: {
          color: paint(style.color),
          stroke: paint(style.stroke),
          fill: paint(style.fill),
          strokeWidth: style.strokeWidth,
          opacity,
        },
      };
    })
  );
}
