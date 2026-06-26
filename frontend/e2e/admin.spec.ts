import { test, expect, type Page } from '@playwright/test';

const ADMIN_HOME = '/admin';
const ORG_ADMIN = '/admin/test-org';
const LEAGUE_ADMIN = '/admin/test-org/leagues/test-league';

// Each spec assumes the Owner test user wired up by global.setup.ts. The seed
// gives Test Org 2 leagues, 65 members and 15 current-season matches in
// test-league.

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
    await expect(page.getByRole('heading', { name: 'Test Org' })).toBeVisible();
    await expect(
      page.getByText('Active members', { exact: true })
    ).toBeVisible();
    await expect(page.getByText('Open match flags')).toBeVisible();

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
    await expect(page.getByText(/65 members/i)).toBeVisible();
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
    // The matches page paginates at PAGE_SIZE=25. The seed has thousands of
    // matches so the first page is always full.
    await expect(rows).toHaveCount(25);
    await expect(page.getByText('Latest', { exact: true })).toBeVisible();
  });

  test('matches page groups matches under date headers', async ({ page }) => {
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    // Rows stay individually addressable (headers are separate divs).
    await expect(page.getByTestId('admin-match-row')).toHaveCount(25);
    // The seed's matches predate "today", so the first page renders at least
    // one date header above its match rows.
    await expect(
      page.getByTestId('admin-match-date-header').first()
    ).toBeVisible();
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
    // Test League is fixed-target (winning_score = 10), so we must submit a
    // valid winner/loser pair regardless of the seed's pre-edit scores.
    const scoreInputs = dialog.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('10');
    await scoreInputs.nth(1).fill('5');
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
    // Create form is hidden by default; clicking the button reveals it. The
    // button is a client-side toggle, so the click only takes effect once
    // SvelteKit has hydrated — under load the SSR'd button can be clicked
    // before its handler is attached and the click is lost. Retry until the
    // form opens; once open the button relabels to "Cancel", so the
    // visibility guard prevents toggling it back closed on a retry.
    const newSeasonButton = page.getByRole('button', { name: 'New season' });
    await expect(newSeasonButton).toBeVisible();
    await expect(async () => {
      if (await newSeasonButton.isVisible()) {
        await newSeasonButton.click();
      }
      await expect(
        page.getByRole('heading', { name: 'Start a new season' })
      ).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  });
});

test.describe('Admin navigation chrome', () => {
  test('admin shell exposes Open Org and Exit Admin', async ({ page }) => {
    await page.goto(ORG_ADMIN);
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
