import { test, expect, type Page } from '@playwright/test';

const DESKTOP_LINKS = [
  'Home',
  'Leaderboard',
  'Matches',
  // The name gains the queue count when players are waiting.
  /^Matchmaking/,
  'Random teams',
  'Profile',
];
const PHONE_LINKS = ['Home', /^Play/, 'Submit', 'Teams', 'Profile'];

async function expectNavLinks(page: Page, names: (string | RegExp)[]) {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(names.length);
  for (const [i, name] of names.entries()) {
    await expect(links.nth(i)).toHaveAccessibleName(name);
  }
}

test.describe('Authed layout chrome', () => {
  test('navbar persists on /random', async ({ page }) => {
    await page.goto('/random');
    await expectNavLinks(page, DESKTOP_LINKS);
  });

  test('navbar persists on /settings', async ({ page }) => {
    await page.goto('/settings');
    await expectNavLinks(page, DESKTOP_LINKS);
  });

  test('the sidebar Profile link opens your own profile', async ({ page }) => {
    await page.goto('/random');
    await expect(
      page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('link', { name: 'Profile', exact: true })
    ).toHaveAttribute(
      'href',
      '/test-org/test-league/player/66666666-6666-6666-6666-666666666601'
    );
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the bottom bar keeps five links', async ({ page }) => {
      await page.goto('/random');
      await expectNavLinks(page, PHONE_LINKS);
    });
  });

  test('navbar links resolve to default org/league when not in a league route', async ({
    page,
  }) => {
    await page.goto('/random');

    const homeLink = page.locator('nav a').first();
    // The default league is the first in the API's response, which orders by
    // when the player joined — the seed joins test-league long before
    // singles-league, so test-league is the deterministic default.
    await expect(homeLink).toHaveAttribute('href', /\/test-org\/test-league$/);
  });
});
