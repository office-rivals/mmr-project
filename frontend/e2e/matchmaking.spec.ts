import { test, expect } from '@playwright/test';

const MATCHMAKING_URL = '/test-org/test-league/matchmaking';

test.describe('Matchmaking', () => {
  test('shows queue UI with explanation copy', async ({ page }) => {
    await page.goto(MATCHMAKING_URL);

    await expect(page.getByRole('heading', { name: 'Matchmaking' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Queue up/ })).toBeVisible();
    await expect(page.getByText(/30 seconds/)).toBeVisible();
  });

  test('queue / leave round-trip', async ({ page }) => {
    await page.goto(MATCHMAKING_URL);

    await page.getByRole('button', { name: /Queue up/ }).click();

    await expect(page.getByText(/Waiting for a match/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Leave queue/ })).toBeVisible();

    await page.getByRole('button', { name: /Leave queue/ }).click();
    await expect(page.getByRole('button', { name: /Queue up/ })).toBeVisible();
  });
});
