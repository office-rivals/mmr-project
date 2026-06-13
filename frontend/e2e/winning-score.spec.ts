import { test, expect, type Page } from '@playwright/test';

// Covers the configurable per-league winning score. The happy-path submits are
// already covered elsewhere (submit.spec = fixed-target 2v2, singles.spec =
// free-form 1v1), so this spec targets the parts unique to the winning-score
// feature and NOT exercised there: the fixed-target loser-score bound, the
// free-form validation states (range hint, tie warning, invalid-hides-submit),
// the admin Format display, and the admin create-league winning-score field.
//
// Seed: test-league = 2v2 fixed winning_score 10; singles-league = 1v1 free-form
// (winning_score NULL). Both under test-org where the user is Owner.

const TEST_LEAGUE_SUBMIT = '/test-org/test-league/submit';
const SINGLES_SUBMIT = '/test-org/singles-league/submit';
const ADMIN_LEAGUES = '/admin/test-org/leagues';

async function pickPlayer(page: Page, displayName: string) {
  // Each unfilled slot renders an <input placeholder="Filter...">; once a
  // player is chosen the input becomes a chip, so .first() points at the next
  // slot to fill.
  const input = page.locator('input[placeholder="Filter..."]').first();
  await input.fill(displayName);
  await page
    .getByRole('button', { name: new RegExp(displayName) })
    .first()
    .click();
}

test.describe('Winning score — fixed-target league (test-league, score 10)', () => {
  test('loser score is a 0..9 picker bounded by the winning score', async ({
    page,
  }) => {
    await page.goto(TEST_LEAGUE_SUBMIT);
    // Start from a clean slate so the "You" slot isn't auto-filled from a
    // previous submit's localStorage.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await pickPlayer(page, 'Alice Anderson');
    await pickPlayer(page, 'Bob Brown');
    await pickPlayer(page, 'Carol Carter');
    await pickPlayer(page, 'Dave Davies');

    // Fixed-target leagues use the "Who won?" step (free-form leagues don't).
    await expect(page.getByRole('heading', { name: 'Who won?' })).toBeVisible();
    await page.getByRole('button', { name: /We won/ }).click();

    await expect(
      page.getByRole('heading', { name: /What was their score\?/ })
    ).toBeVisible();
    // winning_score = 10 → the loser can score 0 (🥚) through 9, never 10+.
    // Scope to the score-step so the count-0 checks can't be confounded by any
    // unrelated '10'/'11' elsewhere on the page.
    const scoreStep = page.locator('#score-step');
    await expect(scoreStep.getByRole('button', { name: '🥚' })).toBeVisible();
    await expect(
      scoreStep.getByRole('button', { name: '9', exact: true })
    ).toBeVisible();
    await expect(
      scoreStep.getByRole('button', { name: '10', exact: true })
    ).toHaveCount(0);
    await expect(
      scoreStep.getByRole('button', { name: '11', exact: true })
    ).toHaveCount(0);
    // Intentionally does not submit — non-mutating.
  });
});

test.describe('Winning score — free-form league (singles-league, null)', () => {
  test('shows a range hint, rejects ties, and gates submit on valid input', async ({
    page,
  }) => {
    await page.goto(SINGLES_SUBMIT);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const team1 = page.locator('#team1-step');
    const team2 = page.locator('#team2-step');
    await team1.locator('input[placeholder="Filter..."]').fill('tuser');
    await team1.getByRole('button', { name: /Test User/ }).click();
    await team2.locator('input[placeholder="Filter..."]').fill('alia');
    await team2.getByRole('button', { name: /Alice Anderson/ }).click();

    const team1Score = page.locator('#team1-score-input');
    const team2Score = page.locator('#team2-score-input');
    const submit = page.getByRole('button', { name: 'Submit the match' });

    // Default hint before any entry.
    await expect(
      page.getByText('Whole numbers from 0 to 255. The higher score wins.')
    ).toBeVisible();

    // A tie shows the warning and hides submit (server rejects ties too).
    await team1Score.fill('11');
    await team2Score.fill('11');
    // Regex dodges the em-dash / apostrophe in the literal copy.
    await expect(page.getByText(/Scores can.t be equal/)).toBeVisible();
    await expect(submit).toHaveCount(0);

    // Out-of-range input maps to the "not entered" sentinel, keeping submit hidden.
    await team1Score.fill('256');
    await team2Score.fill('3');
    await expect(submit).toHaveCount(0);

    // Two distinct valid scores reveal the submit step (higher wins).
    await team1Score.fill('21');
    await team2Score.fill('15');
    await expect(submit).toBeVisible();
    // Intentionally does not submit — singles.spec covers the full submission.
  });
});

test.describe('Winning score — admin Format display', () => {
  test('a fixed-target league shows "First to N"', async ({ page }) => {
    await page.goto('/admin/test-org/leagues/test-league');
    await expect(page.getByText('First to 10')).toBeVisible();
  });

  test('a free-form league shows "Free-form scoring"', async ({ page }) => {
    await page.goto('/admin/test-org/leagues/singles-league');
    await expect(page.getByText('Free-form scoring')).toBeVisible();
  });
});

test.describe('Winning score — admin create-league form', () => {
  // The "New league" button is a client-side toggle, so its click only takes
  // effect after hydration. Retry until the form opens (the button relabels to
  // "Cancel" once open, so the guard never toggles it back closed).
  async function openCreateForm(page: Page) {
    const newLeague = page.getByRole('button', { name: 'New league' });
    await expect(newLeague).toBeVisible();
    await expect(async () => {
      if (await newLeague.isVisible()) {
        await newLeague.click();
      }
      await expect(page.locator('#name')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  }

  test('rejects a winning score above the cap', async ({ page }) => {
    await page.goto(ADMIN_LEAGUES);
    await openCreateForm(page);
    await page.locator('#name').fill('E2E Too High');
    await page.locator('#slug').fill(`e2e-too-high-${Date.now()}`);
    await page.locator('#winningScore').fill('256');
    await page.getByRole('button', { name: 'Create league' }).click();
    // 256 passes the client (input has min=1, no max), so the API enforces the
    // cap (LeagueService.MaxWinningScore = 255). The exact message is owned by
    // the backend, so assert on the stable cap number plus the absence of a
    // success — not the full sentence. No league is created → no seed mutation.
    await expect(page.getByText(/255/)).toBeVisible();
    await expect(page.getByText('League created')).toHaveCount(0);
  });

  test('creates a free-form league when the winning score is left blank', async ({
    page,
  }) => {
    // Mutates the seed (adds a league). Safe only because the suite runs
    // serially (workers:1, fullyParallel:false) with this spec ordered last
    // alphabetically, and global.setup re-seeds every run — so the new league
    // can't leak into sibling specs. Revisit if that config changes (sharding /
    // parallel). The slug is timestamped so a CI retry can't collide on it.
    const slug = `e2e-free-form-${Date.now()}`;
    await page.goto(ADMIN_LEAGUES);
    await openCreateForm(page);
    await page.locator('#name').fill('E2E Free Form');
    await page.locator('#slug').fill(slug);
    // Blank winning score = free-form scoring.
    await page.locator('#winningScore').fill('');
    await page.getByRole('button', { name: 'Create league' }).click();

    await expect(page.getByText('League created')).toBeVisible();

    // The new league reports free-form scoring on its admin overview.
    await page.goto(`/admin/test-org/leagues/${slug}`);
    await expect(page.getByText('Free-form scoring')).toBeVisible();
  });
});
