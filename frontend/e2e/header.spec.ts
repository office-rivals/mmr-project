import { test, expect, type Page } from '@playwright/test';

// Covers the app-shell header (src/routes/(authed)/components/header.svelte):
// the org/league switcher, league-switch sub-route preservation, and the
// settings menu (identity, role badge, Personal Access Tokens, Admin link).
// layout.spec.ts covers the separate bottom NAVBAR; there is no overlap.
//
// Seed facts (scripts/seed-data.sql, applied by global.setup.ts):
//   - Test Org (test-org): user is OWNER. Leagues: Test League (test-league,
//     2v2, fixed score 10) and Singles League (singles-league, 1v1, free-form).
//   - Other Org (other-org): user is MEMBER. League: Other League.
//   - Test user league_player ids: test-league 66666666-…-601, singles-league
//     66666666-…-701. Another test-league player (Dave Davies / dada):
//     05f2a382-cd67-5017-8d13-2e331fad5e67.

const TEST_LEAGUE = '/test-org/test-league';
const SELF_PLAYER_TEST_LEAGUE = '66666666-6666-6666-6666-666666666601';
const SELF_PLAYER_SINGLES_LEAGUE = '66666666-6666-6666-6666-666666666701';
const OTHER_PLAYER_TEST_LEAGUE = '05f2a382-cd67-5017-8d13-2e331fad5e67';

// The switcher trigger is a client-side bits-ui button, so the click that
// opens it only takes effect after SvelteKit hydration — under load a click
// on the SSR'd trigger can be lost. Retry until the menu opens, guarded by
// aria-expanded so we never toggle an already-open menu back closed.
async function openSwitcher(page: Page) {
  const trigger = page.getByRole('button', {
    name: 'Switch organization or league',
  });
  await expect(trigger).toBeVisible();
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

async function openSettings(page: Page) {
  const trigger = page.getByRole('button', { name: 'Settings menu' });
  await expect(trigger).toBeVisible();
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

// Open the switcher and pick a league by name; the menu auto-closes on select
// and SvelteKit navigates.
async function switchToLeague(page: Page, leagueName: string) {
  await openSwitcher(page);
  await page.getByRole('menuitem', { name: leagueName }).click();
}

test.describe('Header — org/league switcher', () => {
  test('trigger shows the current org and league on a league route', async ({
    page,
  }) => {
    await page.goto(TEST_LEAGUE);
    const trigger = page.getByRole('button', {
      name: 'Switch organization or league',
    });
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Test Org');
    await expect(trigger).toContainText('Test League');
  });

  test('trigger shows "Select league" off a league route', async ({ page }) => {
    await page.goto('/settings');
    const trigger = page.getByRole('button', {
      name: 'Switch organization or league',
    });
    await expect(trigger).toBeVisible();
    // page.params.leagueSlug is undefined on /settings, so currentLeague is
    // undefined and the second line falls back to the placeholder.
    await expect(trigger).toContainText('Select league');
  });

  test('lists every org and league grouped by organization', async ({
    page,
  }) => {
    await page.goto(TEST_LEAGUE);
    await openSwitcher(page);
    const menu = page.getByRole('menu');
    // Org group headings (one per organization the user belongs to).
    await expect(menu.getByText('Test Org', { exact: true })).toBeVisible();
    await expect(menu.getByText('Other Org', { exact: true })).toBeVisible();
    // The switcher only lists leagues the user is a player in (driven by
    // me.organizations[].leagues). The user plays in both Test Org leagues.
    await expect(
      menu.getByRole('menuitem', { name: 'Test League' })
    ).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: 'Singles League' })
    ).toBeVisible();
    // Other League exists in Other Org but the user isn't a player there, so it
    // must NOT appear as a selectable item (the switcher lists joined leagues
    // only — the Other Org group shows the "No leagues" placeholder instead).
    await expect(
      menu.getByRole('menuitem', { name: 'Other League' })
    ).toHaveCount(0);
  });

  test('shows a disabled "No leagues" item for an org the user has no leagues in', async ({
    page,
  }) => {
    await page.goto(TEST_LEAGUE);
    await openSwitcher(page);
    // The user is a Member of Other Org but isn't a player in its league, so
    // that group renders a single non-actionable placeholder item.
    const noLeagues = page
      .getByRole('menu')
      .getByRole('menuitem', { name: 'No leagues' });
    await expect(noLeagues).toBeVisible();
    await expect(noLeagues).toHaveAttribute('aria-disabled', 'true');
  });

  test('marks the current league as active', async ({ page }) => {
    await page.goto(TEST_LEAGUE);
    await openSwitcher(page);
    // The current league is flagged semantically with aria-current; sibling
    // leagues are not.
    await expect(
      page.getByRole('menuitem', { name: 'Test League' })
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      page.getByRole('menuitem', { name: 'Singles League' })
    ).not.toHaveAttribute('aria-current', 'true');
  });

  test('supports keyboard navigation and closes on Escape', async ({
    page,
  }) => {
    await page.goto(TEST_LEAGUE);
    await openSwitcher(page);
    // Arrow keys move roving focus *between* menuitems (real menu semantics),
    // not just onto one.
    const focused = page.locator('[role="menuitem"]:focus');
    await page.keyboard.press('ArrowDown');
    await expect(focused).toBeVisible();
    const firstFocused = (await focused.textContent())?.trim();
    await page.keyboard.press('ArrowDown');
    await expect(focused).toBeVisible();
    const secondFocused = (await focused.textContent())?.trim();
    expect(secondFocused).not.toBe(firstFocused);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
  });
});

test.describe('Header — league switch preserves the sub-route', () => {
  // Portable sub-routes (no league-scoped id) carry over verbatim.
  for (const sub of ['matchmaking', 'statistics', 'submit']) {
    test(`/${sub} carries over to the target league`, async ({ page }) => {
      await page.goto(`${TEST_LEAGUE}/${sub}`);
      await switchToLeague(page, 'Singles League');
      await expect(page).toHaveURL(
        new RegExp(`/test-org/singles-league/${sub}$`),
        { timeout: 15_000 }
      );
    });
  }

  test('the league root switches to the target league root', async ({
    page,
  }) => {
    await page.goto(TEST_LEAGUE);
    await switchToLeague(page, 'Singles League');
    await expect(page).toHaveURL(/\/test-org\/singles-league$/, {
      timeout: 15_000,
    });
  });

  test('your own profile remaps to your profile in the target league', async ({
    page,
  }) => {
    await page.goto(`${TEST_LEAGUE}/player/${SELF_PLAYER_TEST_LEAGUE}`);
    await switchToLeague(page, 'Singles League');
    await expect(page).toHaveURL(
      new RegExp(
        `/test-org/singles-league/player/${SELF_PLAYER_SINGLES_LEAGUE}$`
      ),
      { timeout: 15_000 }
    );
  });

  test("another player's profile falls back to the league root", async ({
    page,
  }) => {
    // A league-scoped id that isn't the current user's isn't portable, so the
    // switch drops to the destination league root rather than 404-ing.
    await page.goto(`${TEST_LEAGUE}/player/${OTHER_PLAYER_TEST_LEAGUE}`);
    await switchToLeague(page, 'Singles League');
    await expect(page).toHaveURL(/\/test-org\/singles-league$/, {
      timeout: 15_000,
    });
  });
});

test.describe('Header — settings menu', () => {
  test('shows the user identity, current org and role', async ({ page }) => {
    await page.goto(TEST_LEAGUE);
    await openSettings(page);
    const menu = page.getByRole('menu');
    await expect(menu.getByText('Test User', { exact: true })).toBeVisible();
    await expect(menu.getByText('@tuser', { exact: true })).toBeVisible();
    await expect(menu.getByText('Test Org', { exact: true })).toBeVisible();
    await expect(menu.getByText('Owner', { exact: true })).toBeVisible();
    // Menu items.
    await expect(
      menu.getByRole('menuitem', { name: 'Personal Access Tokens' })
    ).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Admin' })).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: 'Sign out' })
    ).toBeVisible();
  });

  test('Personal Access Tokens links to /settings', async ({ page }) => {
    await page.goto(TEST_LEAGUE);
    await openSettings(page);
    await page
      .getByRole('menuitem', { name: 'Personal Access Tokens' })
      .click();
    await expect(page).toHaveURL(/\/settings$/, { timeout: 15_000 });
  });

  test('Admin deep-links to the current org when the user administers it', async ({
    page,
  }) => {
    await page.goto(TEST_LEAGUE);
    await openSettings(page);
    await page.getByRole('menuitem', { name: 'Admin' }).click();
    await expect(page).toHaveURL(/\/admin\/test-org$/, { timeout: 15_000 });
  });

  test('Admin falls back to /admin when the current org is not administered', async ({
    page,
  }) => {
    // On the Other Org route the user is only a Member, so the Admin item
    // still shows (they own Test Org) but links to the generic /admin landing.
    await page.goto('/other-org');
    await openSettings(page);
    await expect(
      page.getByRole('menu').getByText('Member', { exact: true })
    ).toBeVisible();
    // The Admin item must still be shown (the user administers Test Org); a
    // regression that hid it for a non-administered org should fail here, not
    // on a click timeout below.
    const adminItem = page.getByRole('menuitem', { name: 'Admin' });
    await expect(adminItem).toBeVisible();
    await adminItem.click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  });
});
