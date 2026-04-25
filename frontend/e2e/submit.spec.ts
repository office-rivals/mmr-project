import { test, expect } from '@playwright/test';

const SUBMIT_URL = '/test-org/test-league/submit';

test.describe('Submit match', () => {
  test('step-by-step flow: pick players → who won → loser score → preview', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    await expect(
      page.getByRole('heading', { name: 'Submit match' })
    ).toBeVisible();
    await expect(page.getByText('Team 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Team 2', { exact: true })).toBeVisible();

    // "We won" / "They won" buttons only appear after all 4 player slots are filled.
    await expect(page.getByRole('button', { name: /We won/ })).toHaveCount(0);
  });

  test('add new player dialog opens from the field', async ({ page }) => {
    await page.goto(SUBMIT_URL);

    // Type a string that won't match any seeded player to surface "Add new player".
    const youField = page.locator('input[placeholder="Filter..."]').first();
    await youField.fill('zzzzznoplayer');

    await expect(
      page.getByRole('button', { name: 'Add new player' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add new player' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Add new player')).toBeVisible();
    await expect(dialog.getByLabel('Display name')).toBeVisible();
    await expect(dialog.getByLabel('Email (optional)')).toBeVisible();
  });
});
