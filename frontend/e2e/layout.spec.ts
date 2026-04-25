import { test, expect } from '@playwright/test';

test.describe('Authed layout chrome', () => {
  test('navbar persists on /random', async ({ page }) => {
    await page.goto('/random');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Five buttons: Home, Matchmaking, Submit, Random, Profile
    await expect(nav.getByRole('link')).toHaveCount(5);
  });

  test('navbar persists on /settings', async ({ page }) => {
    await page.goto('/settings');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link')).toHaveCount(5);
  });

  test('navbar links resolve to default org/league when not in a league route', async ({
    page,
  }) => {
    await page.goto('/random');

    const homeLink = page.locator('nav a').first();
    await expect(homeLink).toHaveAttribute('href', /\/test-org\/test-league$/);
  });
});
