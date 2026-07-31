import { test, expect, type Page } from '@playwright/test';

const SUBMIT_URL = '/test-org/test-league/submit';

async function pickPlayer(page: Page, displayName: string) {
  // Each unfilled slot renders an <input placeholder="Filter...">; once a
  // player is chosen the input is replaced by a name display, so .first()
  // always points at the next slot to fill.
  const input = page.locator('input[placeholder="Filter..."]').first();
  await input.fill(displayName);
  await page
    .getByRole('option', { name: new RegExp(displayName) })
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

  test('keyboard: arrow keys highlight a suggestion, Enter picks it without submitting', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);
    // Clear the localStorage-driven auto-fill / "Recent players" list so the You
    // slot starts empty and the only options come from the typed filter.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const team1 = page.locator('#team1-step');
    const youField = team1.locator('input[placeholder="Filter..."]').first();
    await youField.fill('Alice');
    // Alice is already a league player, so she matches exactly one option.
    await expect(team1.getByRole('option')).toHaveCount(1);

    // Enter straight after typing picks the top suggestion.
    await youField.press('Enter');
    await expect(team1.getByText('Alice Anderson')).toBeVisible();

    // Arrow keys highlight, Enter picks the highlighted option.
    const teammate = team1.locator('input[placeholder="Filter..."]').first();
    await teammate.fill('Bob');
    await teammate.press('ArrowDown');
    // Bob Brown is the only league player matching, so he's the first option.
    await expect(team1.getByRole('option').first()).toHaveAttribute(
      'data-highlighted',
      ''
    );
    await teammate.press('Enter');
    await expect(team1.getByText('Bob Brown')).toBeVisible();

    // Enter must not have submitted the form.
    await expect(
      page.getByRole('heading', { name: 'Submit match' })
    ).toBeVisible();
    await expect(page.getByText(/must have at least one player/)).toHaveCount(
      0
    );

    // Nothing matches → Enter is a no-op, still no submit. Team 1 is full by
    // now, so the next empty slot is the first opponent.
    const opponent = page
      .locator('#team2-step')
      .locator('input[placeholder="Filter..."]')
      .first();
    await opponent.fill('zzzzznoplayer');
    await opponent.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'Submit match' })
    ).toBeVisible();
    await expect(page.getByText(/must have at least one player/)).toHaveCount(
      0
    );
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
