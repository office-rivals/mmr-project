// Behaviour of the two player pickers:
//   - submit/components/team-member-field.svelte  (match submission slots)
//   - player/[id]/components/filter.svelte        (compare filter on a profile)
//
// The compare filter had no e2e coverage at all, and the submit picker was only
// covered incidentally by the flows that use it to fill a match. These specs
// pin the picker interactions themselves.
import { test, expect, type Page } from '@playwright/test';

// Fixture ids from scripts/seed-data.sql (Test League, team size 2).
const TEST_LEAGUE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_USER_LEAGUE_PLAYER_ID = '66666666-6666-6666-6666-666666666601';
const ALICE_LEAGUE_PLAYER_ID = 'bed02f01-6ea5-514a-9815-dbf9fdaacfa7';
const BOB_LEAGUE_PLAYER_ID = 'f6a97f23-2a35-58c3-b1e0-6085c728ae2d';

const SUBMIT_URL = '/test-org/test-league/submit';
const PROFILE_URL = `/test-org/test-league/player/${TEST_USER_LEAGUE_PLAYER_ID}`;

// The "You" slot is autofocused, so a keypress can land before SvelteKit has
// hydrated and attached its handlers — the browser then applies its own default
// (implicit form submission) and the test sees a phantom failure. Waiting for
// the network to settle is a cheap gate that keeps these specs deterministic.
const gotoHydrated = (page: Page, url: string) =>
  page.goto(url, { waitUntil: 'networkidle' });

// Suggestions render as PlayerButton, i.e. a <button> element. Matching the
// element rather than an ARIA role keeps these specs stable if the picker's
// listbox semantics change.
const suggestion = (scope: Page, name: string | RegExp) =>
  scope.locator('button', { hasText: name }).first();

// The submit page reads its quick-pick list from localStorage, so seed it
// before the page's hydration effect runs.
async function seedRecentPlayers(page: Page, leaguePlayerIds: string[]) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [`latestLeaguePlayerIds:${TEST_LEAGUE_ID}`, leaguePlayerIds.join(',')]
  );
}

test.describe('Submit — player slot picker', () => {
  test('lists recent players for an empty slot without further interaction', async ({
    page,
  }) => {
    await seedRecentPlayers(page, [
      ALICE_LEAGUE_PLAYER_ID,
      BOB_LEAGUE_PLAYER_ID,
    ]);
    await gotoHydrated(page, SUBMIT_URL);

    const team1 = page.locator('#team1-step');
    await expect(team1.locator('input[placeholder="Filter..."]')).toBeVisible();
    await expect(team1.getByText('Recent players')).toBeVisible();
    await expect(suggestion(page, 'Alice Anderson')).toBeVisible();
  });

  test('Enter with an empty filter does not pick a player', async ({
    page,
  }) => {
    await seedRecentPlayers(page, [
      ALICE_LEAGUE_PLAYER_ID,
      BOB_LEAGUE_PLAYER_ID,
    ]);
    await gotoHydrated(page, SUBMIT_URL);

    const team1 = page.locator('#team1-step');
    // Team 1 renders one slot heading ("You") until a player is chosen; the
    // teammate slot appearing is an unambiguous "a pick happened" signal.
    await expect(team1.locator('h4')).toHaveCount(1);

    const you = team1.locator('input[placeholder="Filter..."]').first();
    await you.click();
    // Clicking opens the suggestions; asserting that first also guarantees the
    // page is interactive before the keypress below.
    await expect(suggestion(page, 'Alice Anderson')).toBeVisible();

    await you.press('Enter');

    await expect(team1.locator('h4')).toHaveCount(1);
    await expect(you).toBeVisible();
  });

  test('typing a filter and pressing Enter picks the top match', async ({
    page,
  }) => {
    await gotoHydrated(page, SUBMIT_URL);

    const team1 = page.locator('#team1-step');
    const you = team1.locator('input[placeholder="Filter..."]').first();
    await you.click();
    await you.pressSequentially('alia');
    await expect(suggestion(page, 'Alice Anderson')).toBeVisible();

    await you.press('Enter');

    // The filled slot renders the chosen player, and the teammate slot appears.
    await expect(team1.getByText('Alice Anderson')).toBeVisible();
    await expect(team1.locator('h4')).toHaveCount(2);
  });

  test('arrow keys move the highlight and Enter picks the highlighted one', async ({
    page,
  }) => {
    await gotoHydrated(page, SUBMIT_URL);

    const team1 = page.locator('#team1-step');
    const you = team1.locator('input[placeholder="Filter..."]').first();
    await you.click();
    // "ro" matches more than one seeded player (Carol Carter, Bob Brown), which
    // is what makes moving the highlight observable. Their relative order comes
    // from the leaderboard, so this reads the highlight rather than assuming it.
    await you.pressSequentially('ro');
    // Waiting on the second option is how we know there's more than one.
    await expect(team1.locator('button[role="option"]').nth(1)).toBeVisible();

    // data-highlighted is bits-ui's marker for the active option — the thing
    // the arrow keys are meant to move.
    const highlightedName = async () =>
      (await team1.locator('[data-highlighted]').innerText()).split('\n')[0];

    await you.press('ArrowDown');
    const first = await highlightedName();
    await you.press('ArrowDown');
    const second = await highlightedName();
    expect(second).not.toBe(first);

    await you.press('Enter');

    await expect(team1.getByText(second)).toBeVisible();
    await expect(team1.locator('h4')).toHaveCount(2);
  });

  test('Enter with a filter that matches nobody does not submit the match', async ({
    page,
  }) => {
    await gotoHydrated(page, SUBMIT_URL);

    const team1 = page.locator('#team1-step');
    const you = team1.locator('input[placeholder="Filter..."]').first();
    await you.click();
    await you.pressSequentially('zzzzznoplayer');
    await expect(
      page.getByRole('button', { name: 'Add new player' })
    ).toBeVisible();

    await you.press('Enter');

    // Still on the submit page, no pick, and no server-side validation error —
    // implicit form submission would have produced all three.
    await expect(
      page.getByRole('heading', { name: 'Submit match' })
    ).toBeVisible();
    await expect(team1.locator('h4')).toHaveCount(1);
    await expect(page.getByText(/must have at least one player/)).toHaveCount(
      0
    );
  });
});

test.describe('Player profile — compare filter', () => {
  test('picking a player adds a chip and clears the input', async ({
    page,
  }) => {
    await gotoHydrated(page, PROFILE_URL);

    const input = page.locator('input[placeholder="Filter..."]').first();
    await input.click();
    await input.pressSequentially('alia');
    await suggestion(page, 'Alice Anderson').click();

    await expect(
      page.locator('.bg-secondary', { hasText: 'Alice Anderson' })
    ).toBeVisible();
    // The filter is multi-select, so the box has to be ready for the next name.
    await expect(input).toHaveValue('');
  });

  test('a player can be picked again after removing their chip', async ({
    page,
  }) => {
    await gotoHydrated(page, PROFILE_URL);

    const input = page.locator('input[placeholder="Filter..."]').first();
    const chip = page.locator('.bg-secondary', { hasText: 'Alice Anderson' });

    await input.click();
    await input.pressSequentially('alia');
    await suggestion(page, 'Alice Anderson').click();
    await expect(chip).toBeVisible();

    await chip.locator('button').click();
    await expect(chip).toHaveCount(0);

    await input.click();
    await input.fill('');
    await input.pressSequentially('alia');
    await suggestion(page, 'Alice Anderson').click();

    await expect(chip).toBeVisible();
  });
});
