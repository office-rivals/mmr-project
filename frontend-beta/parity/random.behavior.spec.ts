import playwright from '../../frontend/node_modules/@playwright/test/index.js';
const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  test(`${app}: named random teams validate, shuffle, and restore results`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({ ...info.project.use });
    const page = await context.newPage();
    const url = `http://localhost:${port}/random?player=Alice&player=Bob&player=Carol&player=Dave`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== '/random') {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }
    const generate = page.getByRole('button', { name: 'Generate Teams' });
    await expect(generate).toBeEnabled();
    await page.getByLabel('Player 4').fill(' ');
    await expect(generate).toBeDisabled();
    await page.getByLabel('Player 4').fill('Dave');
    await generate.click();
    await expect(
      page.getByRole('heading', { name: 'Team 1', exact: true })
    ).toBeVisible();
    const names = await page.locator('main li').allTextContents();
    expect([...names].sort()).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
    await page.reload();
    await expect(page.locator('main li')).toHaveText(names);
    await context.close();
  });

  test(`${app}: touch randomizer cancels, assigns two teams, and resets`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      ...info.project.use,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const url = `http://localhost:${port}/random`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== '/random') {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }
    const surface = page.getByRole('application', {
      name: 'Touch randomizer surface',
    });
    await expect(surface).toBeVisible();
    const placeFingers = () =>
      surface.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const touches = Array.from(
          { length: 5 },
          (_, identifier) =>
            new Touch({
              identifier,
              target: element,
              clientX: rect.left + 40 + identifier * 55,
              clientY: rect.top + 100 + (identifier % 2) * 100,
            })
        );
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches,
            targetTouches: touches,
            changedTouches: touches,
          })
        );
      });
    await placeFingers();
    await expect(page.getByText('Hold still…', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Names', exact: true }).click();
    await page.getByRole('tab', { name: 'Touch', exact: true }).click();
    await expect(
      page.getByText('Place your fingers', { exact: true })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go again' })).toHaveCount(0);
    await placeFingers();
    const again = page.getByRole('button', { name: 'Go again' });
    await expect(again).toBeVisible();
    await expect(surface.locator('div.border-4.border-white')).toHaveCount(2);
    await expect(surface.locator('div.border-4.border-red-600')).toHaveCount(2);
    await again.tap();
    await expect(
      page.getByText('Place your fingers', { exact: true })
    ).toBeVisible();
    await expect(again).toHaveCount(0);
    await context.close();
  });
}
