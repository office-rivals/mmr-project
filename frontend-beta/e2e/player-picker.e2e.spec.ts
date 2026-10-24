// Behaviour of the two player pickers:
//   - src/components/play/team-member-field.tsx  (match submission slots)
//   - src/components/profile/player-filter.tsx   (compare filter on a profile)
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

  test('from md up the matches stay inline', async ({ page }) => {
    await gotoHydrated(page, SUBMIT_URL);

    const you = page.locator('#team1-step input[placeholder="Filter..."]');
    await you.first().click();
    await you.first().pressSequentially('al');

    await expect(suggestion(page, 'Alice Anderson')).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: 'Choose a player' })
    ).toHaveCount(0);
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
});

test.describe('Submit — player search on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  const search = (page: Page) =>
    page.getByRole('dialog', { name: 'Choose a player' });
  const you = (page: Page) =>
    page.locator('#team1-step input[placeholder="Filter..."]').first();
  const options = (page: Page) => page.locator('#team1-step [role="option"]');

  test('the autofocused slot keeps its recents inline until it is touched', async ({
    page,
  }) => {
    await seedRecentPlayers(page, [
      ALICE_LEAGUE_PLAYER_ID,
      BOB_LEAGUE_PLAYER_ID,
    ]);
    await gotoHydrated(page, SUBMIT_URL);

    await expect(suggestion(page, 'Alice Anderson')).toBeVisible();
    await expect(search(page)).toHaveCount(0);
  });

  test('tapping a slot opens a full-screen search over the bars', async ({
    page,
  }) => {
    await gotoHydrated(page, SUBMIT_URL);
    await you(page).tap();

    await expect(search(page)).toBeVisible();
    expect(await search(page).boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    });
    await expect(you(page)).toBeFocused();
    const coversBottomBar = await page.evaluate(() => {
      const bar = document
        .querySelector('nav[aria-label="Primary"]')!
        .getBoundingClientRect();
      const hit = document.elementFromPoint(
        bar.x + bar.width / 2,
        bar.y + bar.height / 2
      );
      return hit?.closest('[role="dialog"]') != null;
    });
    expect(coversBottomBar).toBe(true);
  });

  test('picking a match closes the search and fills the slot', async ({
    page,
  }) => {
    await gotoHydrated(page, SUBMIT_URL);
    await you(page).tap();
    await you(page).pressSequentially('alia');
    await suggestion(page, 'Alice Anderson').tap();

    await expect(search(page)).toHaveCount(0);
    // The teammate slot only appears once "You" holds a player.
    await expect(page.locator('#team1-step h4')).toHaveCount(2);
  });

  test('Cancel closes the search without picking', async ({ page }) => {
    await gotoHydrated(page, SUBMIT_URL);
    await you(page).tap();
    await you(page).pressSequentially('al');
    await search(page).getByRole('button', { name: 'Cancel' }).tap();

    await expect(search(page)).toHaveCount(0);
    await expect(you(page)).toHaveValue('');
    await expect(you(page)).not.toBeFocused();
    await expect(page.locator('#team1-step h4')).toHaveCount(1);
  });

  test('Escape closes the search and clears the filter', async ({ page }) => {
    await gotoHydrated(page, SUBMIT_URL);
    await you(page).tap();
    await you(page).pressSequentially('al');
    await you(page).press('Escape');

    await expect(search(page)).toHaveCount(0);
    await expect(you(page)).toHaveValue('');
  });

  test('Add new player opens its dialog above the search', async ({ page }) => {
    await gotoHydrated(page, SUBMIT_URL);
    await you(page).tap();
    await you(page).pressSequentially('zzqx');
    await search(page).getByRole('button', { name: 'Add new player' }).tap();

    const dialog = page.getByRole('dialog', { name: 'Add new player' });
    await expect(dialog).toBeVisible();
    const onTop = await dialog.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2
      );
      return el.contains(hit);
    });
    expect(onTop).toBe(true);
  });

  test.describe('with the keyboard up', () => {
    // What a 390×844 phone has left above its on-screen keyboard.
    test.use({ viewport: { width: 390, height: 508 } });

    const inputTop = (page: Page) =>
      you(page).evaluate((el) => el.getBoundingClientRect().top);
    const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

    // Usernames are mostly three letters, so the third keystroke typically
    // narrows several matches to one.
    test('narrowing the matches does not move the input', async ({ page }) => {
      await gotoHydrated(page, SUBMIT_URL);
      await you(page).tap();
      await you(page).pressSequentially('al');
      await expect(options(page)).toHaveCount(4);
      // Scrolled down to read the matches, which an inline list needed.
      await you(page).evaluate((el) =>
        el.scrollIntoView({ block: 'start', behavior: 'instant' })
      );
      const before = { top: await inputTop(page), y: await scrollY(page) };

      await you(page).pressSequentially('i');
      await expect(options(page)).toHaveCount(1);

      expect(await inputTop(page)).toBe(before.top);
      expect(await scrollY(page)).toBe(before.y);
    });

    test('a long list scrolls inside the search, not the page', async ({
      page,
    }) => {
      await gotoHydrated(page, SUBMIT_URL);
      await you(page).tap();
      // Matches the thirteen seeded "Player 0NN"s, far more than fit at once.
      await you(page).pressSequentially('pl');
      await expect(options(page).nth(12)).toBeAttached();
      const y = await scrollY(page);

      await options(page).last().scrollIntoViewIfNeeded();
      await expect(options(page).last()).toBeInViewport({ ratio: 1 });
      expect(await scrollY(page)).toBe(y);
      await expect(you(page)).toBeInViewport({ ratio: 1 });
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
