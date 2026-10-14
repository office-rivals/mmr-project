import { execFileSync } from 'node:child_process';
import playwright from '../../frontend/node_modules/@playwright/test/index.js';

const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const LEAGUE = '/test-org/test-league';

function setLongSeasonList(present: boolean) {
  const statement = present
    ? `
      INSERT INTO seasons (id, organization_id, league_id, starts_at, created_at)
      SELECT
        ('eeeeeeee-5000-0000-0000-' || lpad(number::text, 12, '0'))::uuid,
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '2000-01-01T00:00:00+00:00'::timestamptz + number * interval '1 month',
        '2000-01-01T00:00:00+00:00'::timestamptz + number * interval '1 month'
      FROM generate_series(1, 18) AS number
      ON CONFLICT (id) DO NOTHING;
    `
    : `DELETE FROM seasons WHERE id::text LIKE 'eeeeeeee-5000-%';`;

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
      input: statement,
    }
  );
}

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  test(`${app}: a long season list exposes its scroll controls`, async ({
    browser,
  }, info) => {
    setLongSeasonList(true);
    try {
      const context = await browser.newContext({
        ...info.project.use,
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      const url = `http://localhost:${port}${LEAGUE}`;
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      if (new URL(page.url()).pathname !== LEAGUE) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
      }

      const trigger = page.getByRole('button', { name: 'Select a season' });
      await expect(trigger).toBeEnabled();
      await trigger.click();
      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible();

      const bounds = await listbox.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      const scrollDown = listbox.locator('.lucide-chevrons-down');
      await expect(scrollDown).toBeVisible();
      const viewport = listbox.locator('[data-select-viewport]');
      await scrollDown.hover();
      await expect
        .poll(() => viewport.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      await trigger.hover();

      await trigger.press('End');
      await expect(listbox.getByRole('option').last()).toBeInViewport();
      await context.close();
    } finally {
      setLongSeasonList(false);
    }
  });
}
