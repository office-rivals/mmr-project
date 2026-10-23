// Behaviour of the two player pickers:
//   - src/components/play/team-member-field.tsx  (match submission slots)
//   - src/components/profile/player-filter.tsx   (compare filter on a profile)
//
// The compare filter had no e2e coverage at all, and the submit picker was only
// covered incidentally by the flows that use it to fill a match. These specs
// pin the picker interactions themselves.
import { test, expect, type Locator, type Page } from '@playwright/test';

// Fixture ids from scripts/seed-data.sql (Test League, team size 2).
const TEST_LEAGUE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_USER_LEAGUE_PLAYER_ID = '66666666-6666-6666-6666-666666666601';
const ALICE_LEAGUE_PLAYER_ID = 'bed02f01-6ea5-514a-9815-dbf9fdaacfa7';
const BOB_LEAGUE_PLAYER_ID = 'f6a97f23-2a35-58c3-b1e0-6085c728ae2d';

const SUBMIT_URL = '/test-org/test-league/submit';
const PROFILE_URL = `/test-org/test-league/player/${TEST_USER_LEAGUE_PLAYER_ID}`;

// The "You" slot is autofocused, so a keypress can land before the page has
// hydrated and attached its handlers — the browser then applies its own default
// (implicit form submission) and the test sees a phantom failure. Waiting for
// the network to settle is a cheap gate that keeps these specs deterministic.
const gotoHydrated = (page: Page, url: string) =>
  page.goto(url, { waitUntil: 'networkidle' });

const suggestion = (scope: Page, name: string | RegExp) =>
  scope.getByRole('option', { name }).first();

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
    await expect(team1.locator('[role="option"]').nth(1)).toBeVisible();

    // data-highlighted marks the active option — the thing the arrow keys are
    // meant to move.
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

  test('Escape clears the filter and closes the suggestions', async ({
    page,
  }) => {
    await gotoHydrated(page, SUBMIT_URL);

    const team1 = page.locator('#team1-step');
    const you = team1.locator('input[placeholder="Filter..."]').first();
    await you.click();
    await you.pressSequentially('alia');
    await expect(suggestion(page, 'Alice Anderson')).toBeVisible();

    await you.press('Escape');

    await expect(you).toHaveValue('');
    await expect(team1.locator('[role="option"]')).toHaveCount(0);
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

  // Removing a chip hands the slot back an untouched list of recents, so Enter
  // has to be a no-op there again. The two cases below differ only in how the
  // first pick happened, which is what pins the arrow path specifically: a
  // highlight left over from arrowing must not survive undoing the pick.
  for (const firstPick of ['arrow key', 'click'] as const) {
    test(`Enter stays a no-op after a pick by ${firstPick} is undone`, async ({
      page,
    }) => {
      await seedRecentPlayers(page, [
        ALICE_LEAGUE_PLAYER_ID,
        BOB_LEAGUE_PLAYER_ID,
      ]);
      await gotoHydrated(page, SUBMIT_URL);

      const team1 = page.locator('#team1-step');
      const you = team1.locator('input[placeholder="Filter..."]').first();
      await you.click();
      await expect(suggestion(page, 'Alice Anderson')).toBeVisible();

      if (firstPick === 'arrow key') {
        await you.press('ArrowDown');
        await you.press('Enter');
      } else {
        await suggestion(page, 'Alice Anderson').click();
      }
      await expect(team1.locator('h4')).toHaveCount(2);

      // Undo it. Either recent may be the one that got picked, so this takes
      // the filled slot rather than a name.
      await team1.locator('div.border-input').first().locator('button').click();
      await expect(team1.locator('h4')).toHaveCount(1);

      const backToEmpty = team1
        .locator('input[placeholder="Filter..."]')
        .first();
      await backToEmpty.click();
      await expect(suggestion(page, 'Alice Anderson')).toBeVisible();
      await backToEmpty.press('Enter');

      await expect(team1.locator('h4')).toHaveCount(1);
    });
  }

  test('arrowing past the visible options scrolls the list, not the page', async ({
    page,
  }) => {
    await gotoHydrated(page, SUBMIT_URL);

    const team1 = page.locator('#team1-step');
    const you = team1.locator('input[placeholder="Filter..."]').first();
    await you.click();
    // Matches the thirteen seeded "Player 0NN"s, far more than fit at once.
    await you.pressSequentially('pl');
    const options = team1.locator('[role="option"]');
    await expect(options.nth(7)).toBeAttached();
    const scrollY = await page.evaluate(() => window.scrollY);

    // The first match is already highlighted, so this lands on the eighth.
    for (let i = 0; i < 7; i++) await you.press('ArrowDown');

    await expect(options.nth(7)).toHaveAttribute('data-highlighted');
    // In-viewport accounts for the list's own clipping, not just the window's.
    await expect(options.nth(7)).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  });

  test.describe('on a phone with the keyboard up', () => {
    // What a 390×844 phone has left above its on-screen keyboard.
    test.use({ viewport: { width: 390, height: 508 } });

    const inputTop = (input: Locator) =>
      input.evaluate((el) => el.getBoundingClientRect().top);
    const pageHeight = (page: Page) =>
      page.evaluate(() => document.documentElement.scrollHeight);

    // Usernames are mostly three letters, so the third keystroke typically
    // narrows several matches to one; a shorter page clamped the scroll and
    // threw the input down the screen.
    test('narrowing the matches does not move the input', async ({ page }) => {
      await gotoHydrated(page, SUBMIT_URL);

      const team1 = page.locator('#team1-step');
      const you = team1.locator('input[placeholder="Filter..."]').first();
      await you.focus();
      await you.pressSequentially('al');
      await expect(team1.locator('[role="option"]')).toHaveCount(4);

      // Scrolled down to read the matches, as far as the input stays in view.
      // Any further and it is under the fixed header, where the browser
      // scrolls it back out on the next keystroke whatever the list does.
      await you.evaluate((el) =>
        el.scrollIntoView({ block: 'start', behavior: 'instant' })
      );
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
      const before = await inputTop(you);

      await you.pressSequentially('i');
      await expect(team1.locator('[role="option"]')).toHaveCount(1);

      expect(Math.abs((await inputTop(you)) - before)).toBeLessThanOrEqual(1);
    });

    test('the open list keeps the page one height whatever is typed', async ({
      page,
    }) => {
      await seedRecentPlayers(page, [
        ALICE_LEAGUE_PLAYER_ID,
        BOB_LEAGUE_PLAYER_ID,
      ]);
      await gotoHydrated(page, SUBMIT_URL);

      const team1 = page.locator('#team1-step');
      const you = team1.locator('input[placeholder="Filter..."]').first();
      const options = team1.locator('[role="option"]');
      await you.focus();
      await expect(team1.getByText('Recent players')).toBeVisible();
      const height = await pageHeight(page);

      // A single character shows nothing at all.
      await you.pressSequentially('a');
      await expect(options).toHaveCount(0);
      expect(await pageHeight(page)).toBe(height);

      await you.pressSequentially('l');
      await expect(options).toHaveCount(4);
      expect(await pageHeight(page)).toBe(height);

      await you.pressSequentially('iz');
      await expect(
        page.getByRole('button', { name: 'Add new player' })
      ).toBeVisible();
      expect(await pageHeight(page)).toBe(height);
    });
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

  test('Escape clears the filter and closes the suggestions', async ({
    page,
  }) => {
    await gotoHydrated(page, PROFILE_URL);

    const input = page.locator('input[placeholder="Filter..."]').first();
    await input.click();
    await input.pressSequentially('alia');
    await expect(suggestion(page, 'Alice Anderson')).toBeVisible();

    await input.press('Escape');

    await expect(input).toHaveValue('');
    await expect(page.locator('[role="option"]')).toHaveCount(0);
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
