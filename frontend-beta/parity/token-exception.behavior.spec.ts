import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import type {
  Browser,
  TestInfo,
} from '../../frontend/node_modules/@playwright/test/index.js';

const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

// A successful create exposes the secret once; never retain it in a failure artifact.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('documented token-scope difference', () => {
  const openSettings = async (
    browser: Browser,
    info: TestInfo,
    port: string
  ) => {
    const context = await browser.newContext({ ...info.project.use });
    const page = await context.newPage();
    const url = `http://localhost:${port}/settings`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== '/settings') {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }
    return { context, page };
  };

  for (const [app, port] of [
    ['reference', process.env.E2E_PORT ?? '5180'],
    ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
  ] as const) {
    test(`${app}: token creation retains its documented scope behavior`, async ({
      browser,
    }, info) => {
      const { context, page } = await openSettings(browser, info, port);
      const tokenName = `Scope contract ${app} ${info.retry}`;

      await page.getByRole('button', { name: 'Create New Token' }).click();
      await page.getByLabel('Token Name').fill(tokenName);
      await page.getByRole('button', { name: 'Create Token' }).click();

      if (app === 'reference') {
        await expect(page.getByText('Failed to create token')).toBeVisible();
        await expect(page.getByText('Save your token now!')).toHaveCount(0);
      } else {
        await expect(page.getByText('Save your token now!')).toBeVisible();
        await expect(page.getByText('Failed to create token')).toHaveCount(0);

        page.once('dialog', (dialog) => void dialog.accept());
        await page
          .getByRole('row', { name: new RegExp(tokenName) })
          .getByRole('button', { name: 'Revoke' })
          .click();
        await expect(
          page.getByRole('row', { name: new RegExp(tokenName) })
        ).toHaveCount(0);
      }

      await context.close();
    });
  }
});
