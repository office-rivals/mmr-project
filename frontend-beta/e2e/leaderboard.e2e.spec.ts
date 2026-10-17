import { test, expect } from '@playwright/test';
import { isServerFn } from './server-fns';

const LEAGUE_URL = '/test-org/test-league';
const STANDINGS_URL = `${LEAGUE_URL}/leaderboard`;

// The league rating history behind the sparklines, fetched on client-side
// navigation.
const isRatingHistoryRoute = (url: URL) =>
  isServerFn(url, 'getLeagueRatingHistoryFn');
// A row's sparkline and the line drawn in it.
const SPARKLINE_SELECTOR = 'svg:has(> polyline)';
const SPARKLINE_LINE_SELECTOR = 'polyline';

test.describe('Leaderboard page', () => {
  test('renders sections in the expected order', async ({ page }) => {
    await page.goto(LEAGUE_URL);

    const headings = page.locator('h1, h2');
    await expect(headings.nth(0)).toHaveText('Leaderboard'); // the page's h1
    await expect(headings.nth(1)).toHaveText('Leaderboard'); // h2 above the table
    await expect(headings.nth(2)).toHaveText('Recent Matches'); // h2 above match cards
  });

  test('table has the expected columns', async ({ page }) => {
    await page.goto(LEAGUE_URL);
    // Hidden cells drop out of the role query, so this is what's on screen.
    await expect(
      page.getByRole('table').first().getByRole('columnheader')
    ).toHaveText(['#', 'Player', 'Wins', 'Losses', 'Win %', 'Trend', 'MMR']);
  });

  test('shows the top seven ranked players and links to the standings', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    const ranks = page
      .getByRole('table')
      .first()
      .locator('tbody tr td:first-child');
    await expect(ranks).toHaveText(['1', '2', '3', '4', '5', '6', '7']);

    await page.getByRole('link', { name: /^View all \d+ standings$/ }).click();
    await page.waitForURL(new RegExp(`${STANDINGS_URL}$`));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Leaderboard' })
    ).toBeVisible();
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('shows five rows with a combined W–L column', async ({ page }) => {
      await page.goto(LEAGUE_URL);

      const table = page.getByRole('table').first();
      await expect(table.getByRole('columnheader')).toHaveText([
        '#',
        'Player',
        'W–L',
        'MMR',
      ]);
      await expect(table.getByRole('row')).toHaveCount(1 + 5);
      await expect(
        page.getByRole('link', { name: 'View all standings' })
      ).toBeVisible();
    });
  });

  test('shows username (handle) in match cards, not display name', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);
    const firstCard = page
      .locator('.flex.flex-1.flex-col.items-stretch > div.bg-card')
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

    // The standings should rank the test user (P1) — they have 11 matches in
    // the current season, above the 10-match ranked threshold. Home only
    // shows the top rows, so look on the full standings.
    await page.goto(STANDINGS_URL);
    await expect(page.getByText('Current Season')).toBeVisible();
    await page.getByRole('button', { name: /^Show all/ }).click();
    const rows = page.getByRole('table').first().locator('tbody tr');
    await expect(rows.filter({ hasText: 'tuser' })).toHaveCount(1);
  });

  test('marks players with <10 ranked matches as Unranked', async ({
    page,
  }) => {
    // Players in the seed who only show up in M13/M14 (Eve, Dave) have ≤4
    // matches in the current season → they appear in the standings' Unranked
    // list. Home lists ranked players only.
    await page.goto(STANDINGS_URL);
    await expect(
      page.getByRole('heading', { name: /^Unranked · play 10 matches/ })
    ).toBeVisible();
  });

  test('toggling MMR shows the (+/−delta) inline next to each player', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    const firstCard = page
      .locator('.flex.flex-1.flex-col.items-stretch > div.bg-card')
      .first();
    // MMR off by default — no "(+...)" delta text yet.
    await expect(
      firstCard.locator('span', { hasText: /\(\+\d+\)|\(-\d+\)/ })
    ).toHaveCount(0);

    await page.getByRole('switch', { name: 'MMR:' }).click();

    await expect(
      firstCard.locator('span', { hasText: /\(\+\d+\)|\(-\d+\)/ }).first()
    ).toBeVisible();
  });

  test('clicking a leaderboard row opens the user stats modal', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    // The leader's row: the test user sits outside Home's top rows.
    const firstRow = page
      .getByRole('table')
      .first()
      .locator('tbody tr')
      .first();
    const leader = await firstRow
      .locator('td')
      .nth(1)
      .locator('span')
      .first()
      .textContent();
    await firstRow.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(leader!, { exact: true })).toBeVisible();
    await expect(dialog.getByText('Rank')).toBeVisible();
    await expect(dialog.getByText('# Wins')).toBeVisible();
  });

  test('sparklines draw after navigating away and back', async ({ page }) => {
    // Regression: a sparkline that mounted while the history was still
    // loading never drew its line. Holding the history back guarantees the
    // leaderboard mounts first.
    await page.route(isRatingHistoryRoute, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await route.continue();
    });

    await page.goto(LEAGUE_URL);
    const sparklines = page
      .getByRole('table')
      .first()
      .locator(SPARKLINE_SELECTOR);
    const line = page.locator(SPARKLINE_LINE_SELECTOR);
    await expect(sparklines.locator(line).first()).toBeAttached();

    await page.locator('nav a[href$="/matchmaking"]').click();
    await page.waitForURL(/\/matchmaking$/);
    // Going back before the leaderboard unmounts would not remount it.
    await expect(sparklines).toHaveCount(0);
    await page.goBack();
    await page.waitForURL(new RegExp(`${LEAGUE_URL}$`));

    await expect(sparklines.locator(line).first()).toBeAttached();
    await expect(sparklines.filter({ hasNot: line })).toHaveCount(0);
  });

  test('opening the report-match modal loads recent matches', async ({
    page,
  }) => {
    // Regression: the v3 rewrite of the modal pointed its client-side
    // fetch at /api/v3/... but no app endpoint matched that path,
    // so every open showed "Failed to load matches".
    await page.goto(LEAGUE_URL);

    await page.getByRole('button', { name: 'Report match' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Report a match')).toBeVisible();

    await expect(dialog.getByText('Failed to load matches')).toHaveCount(0);

    // The seed has 15 current-season matches; at least one match button
    // must render inside the dialog.
    await expect(
      dialog.locator('button.w-full.rounded-lg.border').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
