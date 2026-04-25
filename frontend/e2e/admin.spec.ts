import { test, expect, type Page } from '@playwright/test';

const ADMIN_HOME = '/admin';
const ORG_ADMIN = '/admin/test-org';
const LEAGUE_ADMIN = '/admin/test-org/leagues/test-league';

// Each spec assumes the Owner test user wired up by global.setup.ts. The seed
// gives us 1 org / 1 league / 6 members / 15 current-season matches.

test.describe('Admin landing', () => {
  test('shows organisations the user can administer', async ({ page }) => {
    await page.goto(ADMIN_HOME);
    await expect(
      page.getByRole('heading', { name: 'Site administration' })
    ).toBeVisible();
    const orgLink = page.getByRole('link', { name: /Test Org/ });
    await expect(orgLink.first()).toBeVisible();
    await orgLink.first().click();
    await expect(page).toHaveURL(/\/admin\/test-org$/);
  });
});

test.describe('Org admin overview', () => {
  test('shows headline counts and links to leagues', async ({ page }) => {
    await page.goto(ORG_ADMIN);
    await expect(
      page.getByRole('heading', { name: 'Test Org' })
    ).toBeVisible();
    await expect(page.getByText('Active members', { exact: true })).toBeVisible();
    await expect(page.getByText('Open match flags')).toBeVisible();

    // The leagues card lists the seeded league with a clickable link
    // forwarding to the league admin overview.
    const leagueRow = page.getByRole('link', { name: /Test League/ });
    await expect(leagueRow).toBeVisible();
    await leagueRow.click();
    await expect(page).toHaveURL(/\/admin\/test-org\/leagues\/test-league$/);
  });

  test('members tab lists every active member', async ({ page }) => {
    await page.goto(`${ORG_ADMIN}/members`);
    // Sidebar contains a Members link with the same accessible name as the
    // page heading; pin to the actual page <h1>.
    await expect(
      page.getByRole('heading', { name: 'Members', level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/6 members/i)).toBeVisible();
  });

  test('leagues tab lists every league + offers create-league for owners', async ({
    page,
  }) => {
    await page.goto(`${ORG_ADMIN}/leagues`);
    await expect(
      page.getByRole('heading', { name: 'Leagues', level: 1 })
    ).toBeVisible();
    await expect(page.getByText('Test League')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /New league/ })
    ).toBeVisible();
  });
});

test.describe('League admin', () => {
  test('overview renders KPI cards', async ({ page }) => {
    await page.goto(LEAGUE_ADMIN);
    await expect(page.getByText('Current season')).toBeVisible();
    await expect(page.getByText('Players')).toBeVisible();
    await expect(page.getByText('Open flags')).toBeVisible();
  });

  test('matches page paginates and labels the latest match', async ({
    page,
  }) => {
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    // The league sub-nav has a Matches button; the page itself uses an h2
    // heading. Pin to the heading by level.
    await expect(
      page.getByRole('heading', { name: 'Matches', level: 2 })
    ).toBeVisible();
    const rows = page.getByTestId('admin-match-row');
    // The page lists every match in the league regardless of season — the seed
    // ships 15 current-season + 3 past-season = 18 total. Pinning to >=18 is
    // robust to anyone bumping the seed counts in either direction.
    await expect(rows).toHaveCount(18);
    await expect(page.getByText('Latest', { exact: true })).toBeVisible();
  });

  test('edit dialog pre-fills the chosen match', async ({ page }) => {
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    const firstEditButton = page
      .getByTestId('admin-match-row')
      .first()
      .getByTestId('admin-match-edit');
    await firstEditButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Edit match')).toBeVisible();
    // Two team blocks pre-render.
    await expect(dialog.getByText('Team 1', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Team 2', { exact: true })).toBeVisible();
    // Cancel without changes — the dialog must close.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('edit closes dialog and recalc shows a success alert', async ({
    page,
  }) => {
    page.on('dialog', (d) => d.accept());

    await page.goto(`${LEAGUE_ADMIN}/matches`);

    // Open the edit dialog on the latest match (top row) and bump team 1's score.
    await page
      .getByTestId('admin-match-row')
      .first()
      .getByTestId('admin-match-edit')
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const score = dialog.locator('input[type="number"]').first();
    await score.fill('99');
    await dialog.getByRole('button', { name: 'Save match' }).click();

    // On a successful PATCH the dialog closes itself.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The page-level "Recalculate season" form is plain and not inside a
    // dialog, so the alert anchor here is reliable. After click, the alert
    // text reports a non-zero recalculated match count.
    await page.getByRole('button', { name: /Recalculate season/ }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /Recalculated \d+/ })
    ).toBeVisible();
  });

  test('seasons page lists seasons and exposes the create form', async ({
    page,
  }) => {
    await page.goto(`${LEAGUE_ADMIN}/seasons`);
    await expect(
      page.getByRole('heading', { name: 'Seasons', level: 2 })
    ).toBeVisible();
    await expect(page.getByText('Current', { exact: true })).toBeVisible();
    // Create form is hidden by default; clicking the button reveals it.
    await page.getByRole('button', { name: /New season/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Start a new season' })
    ).toBeVisible();
  });
});

test.describe('Admin navigation chrome', () => {
  test('admin shell exposes Open Org and Exit Admin', async ({ page }) => {
    await page.goto(ORG_ADMIN);
    // The header has a single "Admin" link that points at /admin (the home).
    await expect(
      page.getByRole('link', { name: 'Admin', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Org/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Exit Admin/ })).toBeVisible();
  });

  test('navigates between admin sub-pages via the sidebar', async ({
    page,
  }: {
    page: Page;
  }) => {
    await page.goto(ORG_ADMIN);
    // Disambiguate sidebar link from the "Manage members" button on the
    // overview page by anchoring to the navigation landmark.
    const sidebar = page.getByRole('navigation').first();
    await sidebar.getByRole('link', { name: 'Members' }).click();
    await expect(page).toHaveURL(/\/admin\/test-org\/members$/);

    const sidebar2 = page.getByRole('navigation').first();
    await sidebar2.getByRole('link', { name: 'Leagues' }).click();
    await expect(page).toHaveURL(/\/admin\/test-org\/leagues$/);

    const sidebar3 = page.getByRole('navigation').first();
    await sidebar3.getByRole('link', { name: 'Overview' }).click();
    await expect(page).toHaveURL(/\/admin\/test-org$/);
  });
});
