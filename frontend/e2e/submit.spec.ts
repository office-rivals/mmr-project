import { test, expect, type Page } from '@playwright/test';

const SUBMIT_URL = '/test-org/test-league/submit';

async function pickPlayer(page: Page, displayName: string) {
  // Each unfilled slot renders an <input placeholder="Filter...">; once a
  // player is chosen the input is replaced by a name display, so .first()
  // always points at the next slot to fill.
  const input = page.locator('input[placeholder="Filter..."]').first();
  await input.fill(displayName);
  await page
    .getByRole('button', { name: new RegExp(displayName) })
    .first()
    .click();
}

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
    await expect(dialog.getByLabel('Username (optional)')).toBeVisible();
    await expect(dialog.getByLabel('Email (optional)')).toBeVisible();
  });

  // Regression: previewMatch() previously spread {displayName, username} onto
  // each player, letting MatchCard prefer the username (short handle). The new
  // code only populates displayName so the preview shows the full display name.
  test('preview renders displayName, not username, for league players', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    // Fill all four slots with seeded players.
    await pickPlayer(page, 'Alice Anderson');
    await pickPlayer(page, 'Bob Brown');
    await pickPlayer(page, 'Carol Carter');
    await pickPlayer(page, 'Dave Davies');

    await expect(page.getByRole('heading', { name: 'Who won?' })).toBeVisible();
    await page.getByRole('button', { name: /We won/ }).click();

    await expect(
      page.getByRole('heading', { name: /What was their score\?/ })
    ).toBeVisible();
    await page.getByRole('button', { name: '5', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Submit?' })).toBeVisible();

    const preview = page.locator('#submit-step');

    // The preview must show full display names …
    await expect(preview.getByText('Alice Anderson')).toBeVisible();
    await expect(preview.getByText('Dave Davies')).toBeVisible();

    // … not the short username handles that real match cards show.
    await expect(preview.getByText('alia', { exact: true })).toHaveCount(0);
    await expect(preview.getByText('dada', { exact: true })).toHaveCount(0);
  });

  test('dialog cancel closes without saving the player', async ({ page }) => {
    await page.goto(SUBMIT_URL);

    const youField = page.locator('input[placeholder="Filter..."]').first();
    await youField.fill('zzzzznoplayer');
    await page.getByRole('button', { name: 'Add new player' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill in a display name then cancel — the slot must remain empty.
    await dialog.getByLabel('Display name').fill('Should Not Save');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).not.toBeVisible();
    // The "You" slot filter input re-appears, confirming the slot is still empty.
    await expect(
      page.locator('input[placeholder="Filter..."]').first()
    ).toBeVisible();
  });

  test('dialog shows validation error when display name is empty', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    const youField = page.locator('input[placeholder="Filter..."]').first();
    await youField.fill('zzzzznoplayer');
    await page.getByRole('button', { name: 'Add new player' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Attempt to save without entering a display name.
    await dialog.getByRole('button', { name: 'Use player' }).click();

    // The dialog must stay open and show the error.
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Display name is required')).toBeVisible();
  });

  test('new player created via dialog appears in preview with their displayName', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    // Pick three seeded players first (team 1 + two opponents).
    await pickPlayer(page, 'Alice Anderson');
    await pickPlayer(page, 'Bob Brown');
    await pickPlayer(page, 'Carol Carter');

    // For the fourth slot, create a brand-new player via the dialog.
    const lastInput = page.locator('input[placeholder="Filter..."]').first();
    await lastInput.fill('zzzzznoplayer');
    await page.getByRole('button', { name: 'Add new player' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Display name').fill('Zara Zulu');
    await dialog.getByLabel('Username (optional)').fill('zz99');
    await dialog.getByRole('button', { name: 'Use player' }).click();
    await expect(dialog).not.toBeVisible();

    // Proceed to preview.
    await page.getByRole('button', { name: /We won/ }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Submit?' })).toBeVisible();
    const preview = page.locator('#submit-step');

    // The new player's displayName must appear in the preview — not the
    // username that was entered alongside it.
    await expect(preview.getByText('Zara Zulu')).toBeVisible();
    await expect(preview.getByText('zz99', { exact: true })).toHaveCount(0);
  });
});
