import playwright from '../../frontend/node_modules/@playwright/test/index.js';
const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  test(`${app}: report pagination, back, cancellation, and reopening reset state`, async ({
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
    await expect(dialog.getByText('Page 1', { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Previous' })
    ).toBeDisabled();
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(dialog.getByText('Page 2', { exact: true })).toBeVisible();
    await dialog
      .locator('button.w-full.rounded-lg.border:not(.border-red-400)')
      .first()
      .click();
    const reason = dialog.getByLabel('Reason for flagging');
    await reason.fill('Discard this draft');
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(dialog.getByText('Page 2', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await trigger.click();
    await expect(dialog.getByText('Page 1', { exact: true })).toBeVisible();
    await dialog
      .locator('button.w-full.rounded-lg.border:not(.border-red-400)')
      .first()
      .click();
    await expect(dialog.getByLabel('Reason for flagging')).toHaveValue('');
    await context.close();
  });
}
