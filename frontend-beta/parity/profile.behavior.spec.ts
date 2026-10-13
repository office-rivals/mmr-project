import { execFileSync } from 'node:child_process';
import playwright, {
  type Browser,
  type TestInfo,
} from '../../frontend/node_modules/@playwright/test/index.js';

const { expect, test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const PROFILE =
  '/test-org/test-league/player/66666666-6666-6666-6666-666666666601';
const FLAG_ID = 'eeeeeeee-4000-0000-0000-000000000001';

function resetProfileFlag() {
  execFileSync(
    'psql',
    [
      '-h',
      process.env.E2E_DB_HOST ?? 'localhost',
      '-p',
      process.env.E2E_DB_PORT ?? '5433',
      '-U',
      process.env.E2E_DB_USER ?? 'postgres',
      '-d',
      process.env.E2E_DB_NAME ?? 'mmr_project',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: process.env.E2E_DB_PASS ?? 'this_is_a_hard_password1337',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      input: `
        UPDATE match_flags
        SET reason = 'Current-user visual parity flag.',
            status = 0,
            updated_at = '2026-09-10T12:00:00+00:00'
        WHERE id = '${FLAG_ID}';
      `,
    }
  );
}

async function openProfile(browser: Browser, info: TestInfo, port: string) {
  resetProfileFlag();
  const context = await browser.newContext({ ...info.project.use });
  const page = await context.newPage();
  const url = `http://localhost:${port}${PROFILE}`;
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  if (new URL(page.url()).pathname !== PROFILE) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
  }
  await expect(page).toHaveURL(url);
  return { context, page };
}

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  test(`${app}: profile flag feedback clears when changing seasons`, async ({
    browser,
  }, info) => {
    const { context, page } = await openProfile(browser, info, port);

    await page.getByTitle('Edit flag', { exact: true }).click();
    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Edit Flag', exact: true }),
    });
    await dialog.getByLabel('Reason', { exact: true }).fill('Updated reason');
    await dialog.getByRole('button', { name: 'Update Flag' }).click();

    const feedback = page.getByRole('alert').filter({
      hasText: 'Flag updated successfully',
    });
    await expect(feedback).toBeVisible();

    const seasonPicker = page.getByRole('button', {
      name: 'Select a season',
    });
    await seasonPicker.click();
    await page.getByRole('option', { name: 'Season 1', exact: true }).click();
    await expect(seasonPicker).toHaveText(/Season 1/);
    await page.waitForLoadState('networkidle');

    await expect(feedback).toHaveCount(0);
    await context.close();
  });
}
