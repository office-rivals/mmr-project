import playwright from '../../frontend/node_modules/@playwright/test/index.js';

const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  test(`${app}: dialog exposes modal semantics and closes with Escape`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({ ...info.project.use });
    const page = await context.newPage();
    const url = `http://localhost:${port}/test-org/test-league`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== '/test-org/test-league') {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }

    const trigger = page.getByRole('button', {
      name: 'Report match',
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await context.close();
  });
}
