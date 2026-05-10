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

  test('full happy path: fill 4 players → we won → score → submit', async ({
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
    // MatchCard renders username (short handle) when present, not displayName —
    // so seeded players Alice/Bob/Carol/Dave appear as alia/bobr/caca/dada.
    const preview = page.locator('#submit-step');
    await expect(preview.getByText('alia')).toBeVisible();
    await expect(preview.getByText('dada')).toBeVisible();

    await page.getByRole('button', { name: 'Submit the match' }).click();

    // Server-side action redirects to the league leaderboard on success. The
    // URL keeps a `#submit-step` fragment from earlier in-page anchor scrolls,
    // so we check the destination by content instead.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Leaderboard' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recent Matches' })
    ).toBeVisible();
  });
});
