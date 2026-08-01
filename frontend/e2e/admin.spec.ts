import { test, expect, type Page } from '@playwright/test';

const ADMIN_HOME = '/admin';
const ORG_ADMIN = '/admin/test-org';
const LEAGUE_ADMIN = '/admin/test-org/leagues/test-league';

// Each spec assumes the Owner test user wired up by global.setup.ts. The seed
// gives Test Org 2 leagues, 65 members and 15 current-season matches in
// test-league.

async function openEditDialog(page: Page) {
  await page
    .getByTestId('admin-match-row')
    .first()
    .getByTestId('admin-match-edit')
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

// Holds the post-submit data reload open so the window between "PATCH
// succeeded" and "dialog closed" is wide enough to observe. Returns the
// invocation count so a test can prove the stall actually happened — without
// it the window never opens and the assertions inside it are vacuous.
function stallDataReload(page: Page, ms: number) {
  const hits = { count: 0 };
  page.route('**/*__data.json*', async (route) => {
    hits.count += 1;
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
  return hits;
}

function countEditSubmissions(page: Page) {
  // Counted on request, not response: a second submit still in flight when the
  // dialog closes is exactly the bug, and invisible to a response listener.
  const edits = { count: 0 };
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('?/edit')) {
      edits.count += 1;
    }
  });
  return edits;
}

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

  test('double-clicking Save submits the edit only once', async ({ page }) => {
    // Concurrent PATCHes for one match fail server-side for an edit that landed.
    const edits = countEditSubmissions(page);

    await page.goto(`${LEAGUE_ADMIN}/matches`);
    const dialog = await openEditDialog(page);

    const scoreInputs = dialog.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('10');
    await scoreInputs.nth(1).fill('7');

    // requestSubmit twice in one tick: a second real click would be swallowed
    // by the disabled attribute, which would leave enhance's cancel() — the
    // actual guard — unexercised.
    await dialog.locator('form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Match updated' })
    ).toBeVisible();
    await expect.poll(() => edits.count).toBe(1);
  });

  test('a successful save never flashes a validation error', async ({
    page,
  }) => {
    // Svelte syncs bound state back from a reset form, so resetting on success
    // collapses every player <select> onto its first option and the dialog
    // accuses the admin of picking one player four times.
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    const dialog = await openEditDialog(page);

    const scoreInputs = dialog.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('10');
    await scoreInputs.nth(1).fill('5');

    const stalled = stallDataReload(page, 2000);

    const duplicateError = page.getByText(
      'Each player can only appear once across both teams.'
    );
    await dialog.getByRole('button', { name: /Save match|Saving/ }).click();

    // Sample across the whole reload window; the dialog must go straight from
    // open to closed without ever rendering the duplicate-player error.
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      expect(await duplicateError.count()).toBe(0);
      if ((await page.getByRole('dialog').count()) === 0) break;
      await page.waitForTimeout(50);
    }

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Match updated' })
    ).toBeVisible();
    // Without a stalled reload there is no window to observe, and the loop
    // above would pass whether or not the bug is present.
    expect(stalled.count).toBeGreaterThan(0);
  });

  test('a superseded save leaves a reopened dialog alone', async ({ page }) => {
    // Cancelling mid-save and reopening the same row gives the admin a second
    // dialog. The first save's response must not act on it — closing it would
    // throw away edits they have just re-entered, and a second submit racing
    // the first lets the abandoned edit commit last and win.
    const edits = countEditSubmissions(page);

    await page.goto(`${LEAGUE_ADMIN}/matches`);
    let dialog = await openEditDialog(page);
    await dialog.locator('input[type="number"]').nth(0).fill('10');
    await dialog.locator('input[type="number"]').nth(1).fill('6');

    const stalled = stallDataReload(page, 1500);

    // Resolves when the save's response is fully handled, so the assertions
    // below cannot run before the superseded callback has had its chance.
    const savePosted = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('?/edit')
    );
    await dialog.getByRole('button', { name: /Save match|Saving/ }).click();
    await savePosted;

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    dialog = await openEditDialog(page);

    // Save is still disabled: the first request is in flight, and letting a
    // second one out would race it.
    await expect(
      dialog.getByRole('button', { name: /Save match|Saving/ })
    ).toBeDisabled();

    // Re-enables once the first request settles, so this also waits for the
    // superseded callback to have run.
    await expect(
      dialog.getByRole('button', { name: /Save match|Saving/ })
    ).toBeEnabled({ timeout: 10_000 });
    expect(stalled.count).toBeGreaterThan(0);

    // The reopened dialog survived, and no stale error was painted over it.
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Failed to update match' })
    ).toHaveCount(0);
    expect(edits.count).toBe(1);
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
