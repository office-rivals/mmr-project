import { test, expect } from '@playwright/test';

const LEAGUE_URL = '/test-org/test-league';

test.describe('Leaderboard page', () => {
  test('renders sections in the expected order', async ({ page }) => {
    await page.goto(LEAGUE_URL);

    const headings = page.locator('h1, h2');
    await expect(headings.nth(0)).toHaveText('Leaderboard'); // PageTitle uses h1 (page-title.svelte)
    await expect(headings.nth(1)).toHaveText('Recent Matches'); // h2 above match cards
    await expect(headings.nth(2)).toHaveText('Leaderboard'); // h2 above the table
  });

  test('table has the expected columns', async ({ page }) => {
    await page.goto(LEAGUE_URL);
    const headerCells = page.getByRole('table').first().locator('thead th');
    await expect(headerCells).toHaveCount(5);
    await expect(headerCells.nth(0)).toHaveText('#');
    await expect(headerCells.nth(1)).toHaveText('Player');
    // Wins/Losses headers contain a short variant; assert both texts present.
    await expect(headerCells.nth(2)).toContainText(/W(ins)?/);
    await expect(headerCells.nth(3)).toContainText(/L(osses)?/);
    await expect(headerCells.nth(4)).toHaveText('Score');
  });

  test('shows username (handle) in match cards, not display name', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);
    const firstCard = page
      .locator('.flex.flex-1.flex-col.items-stretch > div')
      .first();

    // The seed gives usernames `tuser` (test user), `alia`, `bobr`, etc.
    // and display names like "Test User", "Alice Anderson". Match cards
    // must show the username, not the display name.
    await expect(firstCard).not.toContainText('Alice Anderson');
    await expect(firstCard).not.toContainText('Test User');
  });

  test('defaults to current season (does not show older-season-only data)', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    // The season picker label reads "Current Season" by default.
    await expect(page.getByText('Current Season')).toBeVisible();

    // The leaderboard should include the test user (P1) — they have 11
    // matches in the current season, above the 10-match ranked threshold.
    const rows = page.getByRole('table').first().locator('tbody tr');
    await expect(rows.filter({ hasText: 'tuser' })).toHaveCount(1);
  });

  test('marks players with <10 ranked matches as Unranked', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    // Players in the seed who only show up in M13/M14 (Eve, Dave) have ≤4
    // matches in the current season → they appear under an "Unranked" divider.
    await expect(page.getByText('Unranked', { exact: true })).toBeVisible();
  });

  test('toggling MMR shows the (+/−delta) inline next to each player', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    const firstCard = page
      .locator('.flex.flex-1.flex-col.items-stretch > div')
      .first();
    // MMR off by default — no "(+...)" delta text yet.
    await expect(
      firstCard.locator('span', { hasText: /\(\+\d+\)|\(-\d+\)/ })
    ).toHaveCount(0);

    await page.locator('button[role=checkbox]#show-mmr').click();

    await expect(
      firstCard.locator('span', { hasText: /\(\+\d+\)|\(-\d+\)/ }).first()
    ).toBeVisible();
  });

  test('clicking a leaderboard row opens the user stats modal', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    const tuserRow = page
      .getByRole('table')
      .first()
      .locator('tbody tr')
      .filter({ hasText: 'tuser' });
    await tuserRow.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Test User')).toBeVisible();
    await expect(dialog.getByText('Rank')).toBeVisible();
    await expect(dialog.getByText('# Wins')).toBeVisible();
  });
});
