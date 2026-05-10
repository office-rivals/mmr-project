import { test, expect, type Page } from '@playwright/test';

const SUBMIT_URL = '/test-org/test-league/submit';

/** Select a player from the combobox filter. Each unfilled slot has a
 *  placeholder="Filter..." input; once filled the input is replaced, so
 *  .first() always targets the next open slot. */
async function pickPlayer(page: Page, displayName: string) {
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

  // --- previewMatch() displayName regression tests ---
  // The PR changed previewMatch() so that the preview card receives only
  // `displayName` (resolved as displayName ?? username ?? 'Unknown'), rather
  // than spreading both displayName and username and letting MatchCard choose.
  // These tests confirm the preview renders displayName for league players.

  test('preview match card shows player displayName, not username', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

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

    // The preview card should show displayName values ("Alice Anderson",
    // "Dave Davies"), NOT the short username handles ("alia", "dada").
    await expect(preview.getByText('Alice Anderson')).toBeVisible();
    await expect(preview.getByText('Dave Davies')).toBeVisible();

    // Usernames must NOT appear in the preview.
    await expect(preview.getByText('alia')).toHaveCount(0);
    await expect(preview.getByText('dada')).toHaveCount(0);
  });

  // --- Dialog state tests (openNewPlayerDialog / saveNewPlayer refactor) ---

  test('new player dialog: cancel closes dialog without adding player', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    const youField = page.locator('input[placeholder="Filter..."]').first();
    await youField.fill('zzzzznoplayer');
    await page.getByRole('button', { name: 'Add new player' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill in a display name then click Cancel – the slot must remain empty.
    await dialog.getByLabel('Display name').fill('Temporary Name');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).not.toBeVisible();

    // The "You" slot is still unfilled: the filter input is visible again.
    await expect(
      page.locator('input[placeholder="Filter..."]').first()
    ).toBeVisible();
  });

  test('new player dialog: validation rejects empty display name', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    const youField = page.locator('input[placeholder="Filter..."]').first();
    await youField.fill('zzzzznoplayer');
    await page.getByRole('button', { name: 'Add new player' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Leave Display name blank and try to save.
    await dialog.getByLabel('Display name').clear();
    await dialog.getByRole('button', { name: 'Use player' }).click();

    // Dialog must stay open and show an error.
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Display name is required')).toBeVisible();
  });

  test('new player dialog: saves new player and fills the slot', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    const youField = page.locator('input[placeholder="Filter..."]').first();
    await youField.fill('zzzzznoplayer');
    await page.getByRole('button', { name: 'Add new player' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Display name').fill('New Tester');
    await dialog.getByLabel('Username (optional)').fill('ntester');
    await dialog.getByLabel('Email (optional)').fill('new.tester@example.com');
    await dialog.getByRole('button', { name: 'Use player' }).click();

    // Dialog closes after a valid save.
    await expect(dialog).not.toBeVisible();

    // The slot now shows the chosen display name instead of a filter input.
    await expect(page.getByText('New Tester')).toBeVisible();
  });

  test('new player dialog: re-opening a new slot clears previous inputs', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    // Open dialog for the first slot, fill it, then close.
    const youField = page.locator('input[placeholder="Filter..."]').first();
    await youField.fill('zzzzznoplayer');
    await page.getByRole('button', { name: 'Add new player' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Display name').fill('First Player');
    await dialog.getByLabel('Username (optional)').fill('firstp');
    await dialog.getByRole('button', { name: 'Use player' }).click();
    await expect(dialog).not.toBeVisible();

    // Open dialog for a second slot (teammate).
    const teammateField = page.locator('input[placeholder="Filter..."]').first();
    await teammateField.fill('zzzzznoplayer');
    await page.getByRole('button', { name: 'Add new player' }).click();

    await expect(dialog).toBeVisible();

    // Username field must be empty (not carry over "firstp" from the first open).
    await expect(dialog.getByLabel('Username (optional)')).toHaveValue('');
    await expect(dialog.getByLabel('Email (optional)')).toHaveValue('');
  });
});
