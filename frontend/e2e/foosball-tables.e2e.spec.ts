// Foosball tables against the seed's hardware block (scripts/seed-data.sql):
// Table 1 (Red/White, scoreboard offline 40 h) has a live 3:2 game, Table 2
// (Blue/Yellow, no scoreboard) a finished, claimable 10:7. Nothing here saves:
// the dialogs and forms are opened and cancelled, so the seed stays as it is.
import { test, expect, type Page } from '@playwright/test';

const LEAGUE_URL = '/test-org/test-league';
const HARDWARE_URL = '/admin/test-org/hardware';
const TABLE_1 = 'f005ba11-0000-0000-0000-000000000001';
const TABLE_2 = 'f005ba11-0000-0000-0000-000000000002';

const deviceRow = (page: Page, deviceId: string) =>
  page.locator(`#device-${deviceId}`);
const tableCard = (page: Page, teams: string) =>
  page.locator('[data-slot="card"]').filter({ hasText: `Teams: ${teams}` });

test.describe('Live table on the phone', () => {
  test('shows the score in the scoreboard order, with New game and no Undo', async ({
    page,
  }) => {
    await page.goto(`${LEAGUE_URL}/tables/${TABLE_1}`);
    await expect(page.getByRole('heading', { name: 'Table 1' })).toBeVisible();

    // The scoreboard sits on end A, so Red (team A) is the left column.
    const score = page.getByRole('region', { name: 'Live score' });
    await expect(score).toContainText(/Red\s*3\s*:\s*White\s*2/);
    await expect(score).toContainText(/First to 10 · \d+ min/);
    await expect(page.getByText('The scoreboard is offline')).toBeVisible();
    await expect(page.getByRole('button', { name: /Undo goal/ })).toHaveCount(
      0
    );

    await page.getByRole('button', { name: 'New game' }).click();
    const sheet = page.getByRole('dialog');
    await expect(
      sheet.getByRole('button', { name: 'Save 3 : 2' })
    ).toBeVisible();
    await expect(
      sheet.getByRole('button', { name: 'Throw it away' })
    ).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet).toBeHidden();
  });

  test("a finished table's link opens Who played?", async ({ page }) => {
    await page.goto('/t/table-2');
    await expect(page).toHaveURL(new RegExp(`/submit\\?table=${TABLE_2}`));
    await expect(
      page.getByRole('heading', { name: 'Who played?' })
    ).toBeVisible();
    await expect(page.getByText('Table 2', { exact: true })).toBeVisible();
  });
});

test.describe('Hardware admin', () => {
  test('labels each device and shows its health', async ({ page }) => {
    await page.goto(HARDWARE_URL);

    await expect(deviceRow(page, 'fb-0123456789ab')).toContainText(
      'Table 1 · guarded by Red · counts for White · end A'
    );
    await expect(deviceRow(page, 'fb-0123456789ab')).toContainText('Beam OK');
    await expect(deviceRow(page, 'fb-0123456789ac')).toContainText('Beam weak');
    await expect(deviceRow(page, 'fb-0123456789af')).toContainText(
      'Silent for over 36 h'
    );
    await expect(deviceRow(page, 'fb-0123456789ad')).toContainText(
      'Battery low'
    );
    await expect(deviceRow(page, 'fb-0123456789ad')).toContainText(
      'Too much light'
    );
    await expect(deviceRow(page, 'fb-0123456789ae')).toContainText(
      'Table 2 · guarded by Yellow · counts for Blue · end B'
    );
    await expect(deviceRow(page, 'fb-0123456789ae')).toContainText(
      'Beam blocked'
    );

    await expect(tableCard(page, 'Red · White')).toContainText(
      '2 devices need attention'
    );
    await expect(tableCard(page, 'Blue · Yellow')).toContainText(
      '2 devices need attention'
    );
  });

  test('the overview lists the devices that need attention', async ({
    page,
  }) => {
    await page.goto('/admin/test-org');
    const banner = page.getByTestId('device-attention-banner');
    await expect(banner).toContainText('4 devices need attention');

    await banner.getByRole('link', { name: /fb-0123456789ac/ }).click();
    await expect(page).toHaveURL(`${HARDWARE_URL}#device-fb-0123456789ac`);
    await expect(deviceRow(page, 'fb-0123456789ac')).toBeVisible();
  });

  test('an unclaimed counter says whose goal it counts', async ({ page }) => {
    await page.goto(HARDWARE_URL);
    const form = page.locator('form').filter({ hasText: 'fb-0123456789b0' });
    await form
      .getByLabel('Table', { exact: true })
      .selectOption({ label: 'Table 1' });

    await form.getByRole('button', { name: 'White', exact: true }).click();
    await expect(
      form.getByText('A ball in this goal is a goal for Red.')
    ).toBeVisible();
    await form.getByRole('button', { name: 'Red', exact: true }).click();
    await expect(
      form.getByText('A ball in this goal is a goal for White.')
    ).toBeVisible();
    // Intentionally does not claim — non-mutating.
  });

  test('refuses two teams with the same name', async ({ page }) => {
    await page.goto(HARDWARE_URL);
    const card = tableCard(page, 'Red · White');
    await card.getByRole('button', { name: 'Edit' }).click();
    await card.locator(`#endB-${TABLE_1}`).fill('red');
    await card.getByRole('button', { name: 'Save table' }).click();
    await expect(
      card.getByText('The two teams need different names.')
    ).toBeVisible();
    await card.getByRole('button', { name: 'Cancel' }).click();
  });

  test('opens the beam settings and their Advanced fold', async ({ page }) => {
    await page.goto(HARDWARE_URL);
    const row = deviceRow(page, 'fb-0123456789ac');
    await row.getByRole('button', { name: 'Beam settings' }).click();
    await expect(row.getByText('Beam mode')).toBeVisible();

    await row.getByText('Advanced', { exact: true }).click();
    await expect(
      row.getByLabel('Fitted R_PU (Ω)', { exact: true })
    ).toBeVisible();
    await row.getByRole('button', { name: 'Cancel' }).click();
  });
});
