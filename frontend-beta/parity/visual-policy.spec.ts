import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import { matchingVisualRegions } from './accepted-differences';
import { collectVisualRegions } from './visual-regions';

const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

test('icon policy compares rendered paint and rejects hidden or covered glyphs', async ({
  page,
}) => {
  await page.setContent(`<svg class="lucide-trophy" width="16" height="16"
    style="position:absolute;left:20px;top:80px;color:rgba(250,250,249,.8)"
    stroke="currentColor" fill="none"><path d="M0 0L16 16" /></svg>`);
  const collect = () =>
    page.evaluate(collectVisualRegions, ['svg.lucide-trophy']);
  const reference = await collect();
  await page.locator('svg').evaluate((svg) => {
    svg.style.color = 'oklab(0.984516 -0.000335902 0.0013116 / 0.8)';
  });
  const equivalent = await collect();
  expect(reference[0].appearance.color).toBe('250,250,249,204');
  expect(equivalent[0].appearance).toEqual(reference[0].appearance);
  expect(matchingVisualRegions(reference, equivalent)).toHaveLength(1);

  for (const change of ['color:red', 'opacity:0', 'visibility:hidden']) {
    await page.locator('svg').evaluate((svg, change) => {
      svg.style.cssText = `position:absolute;left:20px;top:80px;color:rgba(250,250,249,.8);${change}`;
    }, change);
    expect(matchingVisualRegions(reference, await collect())).toHaveLength(0);
  }
  await page.locator('svg').evaluate((svg) => {
    svg.style.cssText =
      'position:absolute;left:20px;top:80px;color:rgba(250,250,249,.8)';
  });
  await page.locator('body').evaluate((body) => {
    body.style.opacity = '.5';
  });
  expect(matchingVisualRegions(reference, await collect())).toHaveLength(0);
  await page.locator('body').evaluate((body) => {
    body.style.opacity = '1';
  });

  for (const kind of ['dialog', 'menu', 'listbox', 'header', 'nav']) {
    await page.evaluate((kind) => {
      document.querySelector('#cover')?.remove();
      const cover = document.createElement(
        ['header', 'nav'].includes(kind) ? kind : 'div'
      );
      cover.id = 'cover';
      cover.setAttribute('role', kind);
      cover.style.cssText =
        'position:fixed;left:0;top:70px;width:100px;height:40px;background:black';
      document.body.append(cover);
    }, kind);
    expect(matchingVisualRegions(reference, await collect())).toHaveLength(0);
  }
});
