// Picking from a list by tapping, on a phone-sized touch screen. The mouse and
// keyboard paths are covered in player-picker.e2e.spec.ts and
// season-picker-keyboard.functional.spec.ts.
//
// e2e:production also runs this file in Firefox, but not in WebKit; see the
// smoke projects in production.config.ts.
import { test, expect, type Page } from '@playwright/test';
import { gotoAuthed } from './helpers';

const TEST_LEAGUE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_USER_LEAGUE_PLAYER_ID = '66666666-6666-6666-6666-666666666601';
const ALICE_LEAGUE_PLAYER_ID = 'bed02f01-6ea5-514a-9815-dbf9fdaacfa7';
const BOB_LEAGUE_PLAYER_ID = 'f6a97f23-2a35-58c3-b1e0-6085c728ae2d';

const SUBMIT_URL = '/test-org/test-league/submit';
const PROFILE_URL = `/test-org/test-league/player/${TEST_USER_LEAGUE_PLAYER_ID}`;

// isMobile is left out because Firefox, which shares the production smoke
// project list, does not support it.
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

const suggestion = (page: Page, name: string) =>
  page.getByRole('option', { name }).first();

async function seedRecentPlayers(page: Page, leaguePlayerIds: string[]) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [`latestLeaguePlayerIds:${TEST_LEAGUE_ID}`, leaguePlayerIds.join(',')]
  );
}

test('tapping a recent player fills the submit slot', async ({ page }) => {
  await seedRecentPlayers(page, [ALICE_LEAGUE_PLAYER_ID, BOB_LEAGUE_PLAYER_ID]);
  await gotoAuthed(page, SUBMIT_URL);

  const team1 = page.locator('#team1-step');
  await team1.locator('input[placeholder="Filter..."]').first().tap();
  await suggestion(page, 'Alice Anderson').tap();

  // The teammate slot only appears once "You" holds a player.
  await expect(team1.locator('h4')).toHaveCount(2);
  await expect(team1.getByText('Your teammate')).toBeVisible();
});

test('tapping a typed match fills the submit slot', async ({ page }) => {
  await gotoAuthed(page, SUBMIT_URL);

  const team1 = page.locator('#team1-step');
  const you = team1.locator('input[placeholder="Filter..."]').first();
  await you.tap();
  await you.pressSequentially('alia');
  await suggestion(page, 'Alice Anderson').tap();

  await expect(team1.locator('h4')).toHaveCount(2);
});

test('tapping a player adds them to the profile compare filter', async ({
  page,
}) => {
  await gotoAuthed(page, PROFILE_URL);

  const input = page.locator('input[placeholder="Filter..."]').first();
  await input.tap();
  await input.pressSequentially('alia');
  await suggestion(page, 'Alice Anderson').tap();

  await expect(
    page.locator('.bg-secondary', { hasText: 'Alice Anderson' })
  ).toBeVisible();
  await expect(input).toHaveValue('');
});

test('tapping a season selects it', async ({ page }) => {
  await gotoAuthed(page, '/test-org/test-league');

  const trigger = page.getByRole('combobox', { name: 'Select a season' });
  await expect(trigger).toBeEnabled();
  await trigger.tap();
  await page
    .getByRole('listbox')
    .getByRole('option', { name: 'Season 1' })
    .tap();

  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(trigger).toHaveText(/Season 1/);
});
