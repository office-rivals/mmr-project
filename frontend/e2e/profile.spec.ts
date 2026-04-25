import { test, expect } from '@playwright/test';

const TEST_USER_LEAGUE_PLAYER_ID = '66666666-6666-6666-6666-666666666601';
const PROFILE_URL = `/test-org/test-league/player/${TEST_USER_LEAGUE_PLAYER_ID}`;

test.describe('Player profile', () => {
  test('renders KPI grid with all expected stats', async ({ page }) => {
    await page.goto(PROFILE_URL);

    await expect(page.getByText('MMR', { exact: true })).toBeVisible();
    await expect(page.getByText('# Matches', { exact: true })).toBeVisible();
    await expect(page.getByText('# Wins', { exact: true })).toBeVisible();
    await expect(page.getByText('# Losses', { exact: true })).toBeVisible();
    await expect(page.getByText('Win rate', { exact: true })).toBeVisible();
    await expect(page.getByText('Last match', { exact: true })).toBeVisible();
    await expect(page.getByText('Streak', { exact: true })).toBeVisible();
  });

  test('rating-over-time chart container renders (Carbon CSS loaded)', async ({ page }) => {
    await page.goto(PROFILE_URL);

    await expect(page.getByText('Rating over time')).toBeVisible();

    // Carbon's chart wrapper element. If Carbon's stylesheet isn't loaded the
    // chart is a black-on-black blob; we just check the SVG exists.
    const chart = page.locator('.bx--chart-holder, .cds--chart-holder').first();
    await expect(chart).toBeVisible({ timeout: 15_000 });
    await expect(chart.locator('svg').first()).toBeVisible();
  });

  test('shows opponents and teammates tables', async ({ page }) => {
    await page.goto(PROFILE_URL);

    await expect(page.getByText('Most common opponents')).toBeVisible();
    await expect(page.getByText('Most common teammates')).toBeVisible();
  });

  test('always shows the profile player at top-left of every match card', async ({ page }) => {
    await page.goto(PROFILE_URL);

    // Each MatchCard renders one `.items-start` div per left-team players column.
    // The opponents/teammates tables don't use this class, so every hit is a match card.
    const leftColumns = page.locator('.flex.flex-1.flex-col.items-start');
    const count = await leftColumns.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const firstName = leftColumns.nth(i).locator('p').first();
      await expect(firstName).toContainText('tuser');
    }
  });
});
