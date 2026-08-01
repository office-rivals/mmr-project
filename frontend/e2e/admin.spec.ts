import { test, expect, type Locator, type Page } from '@playwright/test';

const ADMIN_HOME = '/admin';
const ORG_ADMIN = '/admin/test-org';
const LEAGUE_ADMIN = '/admin/test-org/leagues/test-league';

// Each spec assumes the Owner test user wired up by global.setup.ts. The seed
// gives Test Org 2 leagues, 65 members and 15 current-season matches in
// test-league.

// Retries the click: Edit is present in the SSR markup before hydration wires
// its handler up, so a click that lands in that window is silently swallowed
// and the dialog never opens.
async function openEditDialogForRow(page: Page, row: number) {
  const dialog = page.getByRole('dialog');
  await expect(async () => {
    await page
      .getByTestId('admin-match-row')
      .nth(row)
      .getByTestId('admin-match-edit')
      .click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

async function openEditDialog(page: Page) {
  return openEditDialogForRow(page, 0);
}

// Holds the post-submit data reload open so the window between "PATCH
// succeeded" and "dialog closed" is wide enough to observe. The window closes
// on `release()`, not a timer: the assertions inside it would otherwise be
// racing a wall-clock budget that a loaded CI box can blow through. `count`
// proves the stall actually happened — without it the window never opens and
// everything asserted inside it is vacuous.
async function stallDataReload(page: Page) {
  const hits = { count: 0 };
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => (open = resolve));
  await page.route('**/*__data.json*', async (route) => {
    hits.count += 1;
    await gate;
    await route.continue();
  });
  return { hits, release: () => open() };
}

// The failure path never reloads data, so stallDataReload opens no window
// there. Holds the action POST itself instead.
async function stallEditPost(page: Page) {
  const hits = { count: 0 };
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => (open = resolve));
  await page.route(
    (url) => url.pathname.endsWith('/matches') && url.search.includes('/edit'),
    async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      hits.count += 1;
      await gate;
      await route.continue();
    }
  );
  return { hits, release: () => open() };
}

// The form's only submit button. Not selected by accessible name: the label
// swaps to "Saving…" mid-flight, so a name selector has to hardcode both.
const saveButton = (scope: Locator | Page) =>
  scope.locator('form button[type="submit"]');

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
    const dialog = await openEditDialog(page);
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
    // Plain expect, not expect.poll: both requestSubmit calls happen in one
    // tick, so the count is long settled by here. Polling would only wait for
    // the value to *reach* 1 and would never notice it moving past.
    expect(edits.count).toBe(1);
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

    const reload = await stallDataReload(page);

    const duplicateError = page.getByText(
      'Each player can only appear once across both teams.'
    );
    await saveButton(dialog).click();

    // Sample across the whole reload window; the dialog must go straight from
    // open to closed without ever rendering the duplicate-player error.
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      expect(await duplicateError.count()).toBe(0);
      await page.waitForTimeout(50);
    }
    reload.release();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Match updated' })
    ).toBeVisible();
    // Without a stalled reload there is no window to observe, and the loop
    // above would pass whether or not the bug is present.
    expect(reload.hits.count).toBeGreaterThan(0);
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

    const reload = await stallDataReload(page);

    // The response event fires before enhance's callback runs; the stalled
    // reload is what actually holds the window open past this point.
    const savePosted = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('?/edit')
    );
    await saveButton(dialog).click();
    await savePosted;

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    dialog = await openEditDialog(page);

    // Save is still disabled: the first request is in flight, and letting a
    // second one out would race it.
    await expect(saveButton(dialog)).toBeDisabled();

    reload.release();

    // Re-enables once the first request settles, so this also waits for the
    // superseded callback to have run.
    await expect(saveButton(dialog)).toBeEnabled({ timeout: 10_000 });
    expect(reload.hits.count).toBeGreaterThan(0);

    // The reopened dialog survived rather than being closed out from under
    // the admin by the abandoned save's response.
    await expect(dialog).toBeVisible();
    // The save still committed, and the admin is told so — the superseded
    // branch must not swallow the outcome just because the dialog moved on.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Match updated' })
    ).toBeVisible();
    expect(edits.count).toBe(1);
  });

  test('a superseded save leaves the reopened dialog on the saved scores', async ({
    page,
  }) => {
    // The reopened dialog is re-seeded from the page's copy of the match. If
    // that copy is a snapshot taken before the save committed, the dialog
    // renders pre-save scores and saving again reverts the edit that landed.
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    let dialog = await openEditDialog(page);

    const scores = () =>
      page.getByRole('dialog').locator('input[type="number"]');
    const before = await scores().nth(1).inputValue();
    const loser = before === '6' ? '7' : '6';

    await scores().nth(0).fill('10');
    await scores().nth(1).fill(loser);

    const reload = await stallDataReload(page);
    const savePosted = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('?/edit')
    );
    await saveButton(dialog).click();
    await savePosted;

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    dialog = await openEditDialog(page);

    reload.release();
    await expect(saveButton(dialog)).toBeEnabled({ timeout: 10_000 });
    expect(reload.hits.count).toBeGreaterThan(0);

    await expect(scores().nth(1)).toHaveValue(loser);
  });

  test('a superseded save the server rejected still tells the admin', async ({
    page,
  }) => {
    // Dropping a failed response because the dialog moved on leaves the admin
    // believing an edit landed that the server threw out.
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    let dialog = await openEditDialog(page);

    // Test League is fixed-target (winning_score = 10), so 4/3 is rejected.
    await dialog.locator('input[type="number"]').nth(0).fill('4');
    await dialog.locator('input[type="number"]').nth(1).fill('3');

    const post = await stallEditPost(page);
    const savePosted = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('?/edit')
    );
    await saveButton(dialog).click();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    dialog = await openEditDialog(page);

    post.release();
    await savePosted;
    await expect(saveButton(dialog)).toBeEnabled({ timeout: 10_000 });
    expect(post.hits.count).toBe(1);

    // getByText, not getByRole('alert'): the open modal marks the rest of the
    // page aria-hidden, which hides a page-level alert from a role query.
    await expect(
      page.getByText(/exactly 10|Failed to update match/).first()
    ).toBeVisible();
  });

  test('a superseded save clears the previous failure banner', async ({
    page,
  }) => {
    // A save that succeeds must not leave the previous attempt's failure
    // banner standing over rows that now show the new scores.
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    let dialog = await openEditDialog(page);

    await dialog.locator('input[type="number"]').nth(0).fill('4');
    await dialog.locator('input[type="number"]').nth(1).fill('3');
    await saveButton(dialog).click();
    const failure = page.getByText(/exactly 10|Failed to update match/);
    await expect(failure.first()).toBeVisible();

    const post = await stallEditPost(page);
    await dialog.locator('input[type="number"]').nth(0).fill('10');
    await dialog.locator('input[type="number"]').nth(1).fill('6');
    const savePosted = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('?/edit')
    );
    await saveButton(dialog).click();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    dialog = await openEditDialog(page);

    post.release();
    await savePosted;
    await expect(saveButton(dialog)).toBeEnabled({ timeout: 10_000 });
    expect(post.hits.count).toBe(1);

    await expect(failure).toHaveCount(0);
  });

  test('an in-flight save for one match does not disable Save on another', async ({
    page,
  }) => {
    // The guard exists to stop two writes racing on the SAME match. Holding it
    // across matches disables a Save that has nothing in flight behind it.
    const edits = countEditSubmissions(page);

    await page.goto(`${LEAGUE_ADMIN}/matches`);
    const rows = page.getByTestId('admin-match-row');
    const idA = await rows.nth(0).getAttribute('data-match-id');
    const idB = await rows.nth(1).getAttribute('data-match-id');
    expect(idA).not.toBe(idB);

    let dialog = await openEditDialogForRow(page, 0);
    await dialog.locator('input[type="number"]').nth(0).fill('10');
    await dialog.locator('input[type="number"]').nth(1).fill('6');

    const reload = await stallDataReload(page);
    const savePosted = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('?/edit')
    );
    await saveButton(dialog).click();
    await savePosted;

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // A different match: nothing is in flight for it.
    dialog = await openEditDialogForRow(page, 1);

    // Tight timeouts are load-bearing: once the first save settles the button
    // re-enables anyway, so a generous retry would pass on the buggy build.
    await expect(saveButton(dialog)).toHaveText('Save match', {
      timeout: 1000,
    });
    await expect(saveButton(dialog)).toBeEnabled({ timeout: 1000 });

    reload.release();
    expect(reload.hits.count).toBeGreaterThan(0);
    expect(edits.count).toBe(1);
  });

  test('a retry clears the previous save error while it is in flight', async ({
    page,
  }) => {
    // Correcting the input and saving again must not leave the old accusation
    // on screen for the whole round trip.
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    const dialog = await openEditDialog(page);
    const scoreInputs = dialog.locator('input[type="number"]');

    await scoreInputs.nth(0).fill('8');
    await scoreInputs.nth(1).fill('5');
    await saveButton(dialog).click();

    const error = dialog.getByRole('alert').filter({ hasText: /exactly 10/ });
    await expect(error).toBeVisible();

    const reload = await stallDataReload(page);
    await scoreInputs.nth(0).fill('10');
    await saveButton(dialog).click();

    await expect(saveButton(dialog)).toBeDisabled({ timeout: 1000 });
    await expect(error).toHaveCount(0, { timeout: 1000 });

    reload.release();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(reload.hits.count).toBeGreaterThan(0);
  });

  test('edit closes dialog and recalc shows a success alert', async ({
    page,
  }) => {
    page.on('dialog', (d) => d.accept());

    await page.goto(`${LEAGUE_ADMIN}/matches`);

    // Open the edit dialog on the latest match (top row) and bump team 1's score.
    const dialog = await openEditDialog(page);
    // Test League is fixed-target (winning_score = 10), so we must submit a
    // valid winner/loser pair regardless of the seed's pre-edit scores.
    const scoreInputs = dialog.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('10');
    await scoreInputs.nth(1).fill('5');
    await saveButton(dialog).click();

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
