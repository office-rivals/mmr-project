import { test, expect } from '@playwright/test';

const TEST_USER_LEAGUE_PLAYER_ID = '66666666-6666-6666-6666-666666666601';
const PROFILE_URL = `/test-org/test-league/player/${TEST_USER_LEAGUE_PLAYER_ID}`;

test.describe('Player profile', () => {
  test('renders KPI grid with all expected stats', async ({ page }) => {
    await page.goto(PROFILE_URL);

    await expect(page.getByText('MMR', { exact: true })).toBeVisible();
    // Scoped to the tiles' terms: the match history below is headed "Matches".
    for (const label of [
      'Matches',
      'Wins',
      'Losses',
      'Win rate',
      'Last match',
      'Streak',
    ]) {
      await expect(
        page.locator('dt').getByText(label, { exact: true })
      ).toBeVisible();
    }
  });

  test('rating-over-time chart names its range for screen readers', async ({
    page,
  }) => {
    await page.goto(PROFILE_URL);

    const section = page.getByRole('region', { name: 'Rating over time' });
    await expect(section).toBeVisible();
    await expect(
      section.getByRole('img', {
        name: /^Rating over time: from [\d,]+ to [\d,]+, peak [\d,]+ on /,
      })
    ).toBeVisible();
  });

  test('rating-over-time chart plots a line from match times', async ({
    page,
  }) => {
    await page.goto(PROFILE_URL);

    // A missing date field still renders the SVG; only the line path shows it.
    const line = page.getByTestId('rating-line');
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute(
      'd',
      /^M[\d.]+,[\d.]+(?: L[\d.]+,[\d.]+)+$/
    );
    await expect(line).not.toHaveAttribute('d', /NaN/);
  });

  test('shows opponents and teammates tables', async ({ page }) => {
    await page.goto(PROFILE_URL);

    await expect(page.getByText('Most common opponents')).toBeVisible();
    await expect(page.getByText('Most common teammates')).toBeVisible();
  });

  test('always shows the profile player at top-left of every match card', async ({
    page,
  }) => {
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
