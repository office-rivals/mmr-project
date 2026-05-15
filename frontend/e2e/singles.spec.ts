import { test, expect } from '@playwright/test';

// The seed gives Test Org two leagues:
//   - test-league    (2v2 — team_size 2, fixed winning_score 10)
//   - singles-league (1v1 — team_size 1, free-form scoring, 3 league players)
// All assertions in this file are scoped to singles-league.

const ORG_URL = '/test-org';
const LEAGUE_URL = '/test-org/singles-league';
const MATCHMAKING_URL = `${LEAGUE_URL}/matchmaking`;
const SUBMIT_URL = `${LEAGUE_URL}/submit`;
const ADMIN_LEAGUES_URL = '/admin/test-org/leagues';

test.describe('1v1 league', () => {
  test('org landing card labels the singles league as "1v1"', async ({
    page,
  }) => {
    await page.goto(ORG_URL);

    // The singles league card is rendered as a header containing "Singles League"
    // and a description with the format. Scope the assertion to that card to
    // avoid colliding with the 2v2 Test League card on the same page.
    const card = page
      .locator('div')
      .filter({ hasText: /Singles League/ })
      .filter({ hasText: '1v1' })
      .first();
    await expect(card).toBeVisible();
  });

  test('matchmaking page advertises the 1v1 format and 2-player threshold', async ({
    page,
  }) => {
    await page.goto(MATCHMAKING_URL);

    await expect(
      page.getByRole('heading', { name: 'Matchmaking' })
    ).toBeVisible();
    // The matchmaking copy is generated from data.leagueTeamSize:
    //   "queue up for a {1v1|2v2} game"
    //   "Once {2|4} players are in the queue"
    await expect(page.getByText('1v1 game')).toBeVisible();
    await expect(page.getByText('2 players')).toBeVisible();
  });

  test('admin leagues list shows a "1v1" badge for the singles league', async ({
    page,
  }) => {
    await page.goto(ADMIN_LEAGUES_URL);

    const singlesRow = page
      .getByRole('link', { name: /Singles League/ })
      .first();
    await expect(singlesRow).toBeVisible();
    // The badge text comes from formatLeagueFormat(league.teamSize).
    await expect(singlesRow.getByText('1v1', { exact: true })).toBeVisible();
  });

  test('submit page renders a single-player slot per team (no teammate field)', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);

    await expect(
      page.getByRole('heading', { name: 'Submit match' })
    ).toBeVisible();
    await expect(page.getByText('Team 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Team 2', { exact: true })).toBeVisible();
    // 1v1: no teammate / "Opponent 1" / "Opponent 2" labels — just "You" + "Opponent".
    await expect(page.getByText('Your teammate')).toHaveCount(0);
    await expect(page.getByText('Opponent 1', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Opponent 2', { exact: true })).toHaveCount(0);
    await expect(page.getByText('You', { exact: true })).toBeVisible();
  });

  test('submit form renders free-form numeric score inputs (no fixed-target picker)', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const team1 = page.locator('#team1-step');
    const team2 = page.locator('#team2-step');
    await team1.locator('input[placeholder="Filter..."]').fill('tuser');
    await team1.getByRole('button', { name: /Test User/ }).click();
    await team2.locator('input[placeholder="Filter..."]').fill('alia');
    await team2.getByRole('button', { name: /Alice Anderson/ }).click();

    // Free-form: no "Who won?" prompt and no 0-9 button picker. The score-step
    // panel goes straight to the two numeric inputs.
    await expect(page.getByText('Who won?')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: /What was the final score?/ })
    ).toBeVisible();
    await expect(page.locator('#team1-score-input')).toBeVisible();
    await expect(page.locator('#team2-score-input')).toBeVisible();
  });

  test('full free-form 1v1 match submission redirects to the league overview', async ({
    page,
  }) => {
    // Mutates singles-league state. Placed last in the file so prior assertions
    // in this spec see the seeded match count. Re-running the suite re-applies
    // the seed via global.setup.ts.
    await page.goto(SUBMIT_URL);

    // The submit page auto-fills team1_player1 from localStorage["primaryLeaguePlayerId"]
    // (set by previous submits in any league). Clear it so the test runs from a
    // known empty state regardless of what ran before.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const team1 = page.locator('#team1-step');
    const team2 = page.locator('#team2-step');

    // "You" slot — pick the test user.
    await team1.locator('input[placeholder="Filter..."]').fill('tuser');
    await team1.getByRole('button', { name: /Test User/ }).click();

    // "Opponent" slot — pick Alice (seed gives display name "Alice Anderson").
    await team2.locator('input[placeholder="Filter..."]').fill('alia');
    await team2.getByRole('button', { name: /Alice Anderson/ }).click();

    // Free-form scoring: enter raw scores. 21-19 is a typical table-tennis end.
    await page.locator('#team1-score-input').fill('21');
    await page.locator('#team2-score-input').fill('19');

    // Submit. The action POSTs to the API and redirects to the league page.
    await page.getByRole('button', { name: /Submit the match/ }).click();

    await expect(page).toHaveURL(/\/test-org\/singles-league$/, {
      timeout: 15_000,
    });
  });
});
