// A player's matches live on /matches (`?player=`); the profile links there
// instead of listing them itself.
import { test, expect, type Page } from '@playwright/test';
import { gotoAuthed } from './helpers';

const LEAGUE = '/test-org/test-league';
// Fixture ids from scripts/seed-data.sql (Test League).
const ME = '66666666-6666-6666-6666-666666666601';
const ALICE = 'bed02f01-6ea5-514a-9815-dbf9fdaacfa7';

const whose = (page: Page) =>
  page.getByRole('group', { name: 'Whose matches' });
// The player pill; Mine and Everyone are router links with their own state.
const playerPill = (page: Page) =>
  whose(page).locator('span[aria-current="true"]');
const feed = (page: Page) => page.getByRole('region', { name: 'Match feed' });
// One `.items-start` column per card holds its left team, viewer first.
const leftColumns = (page: Page) =>
  feed(page).locator('.flex.flex-1.flex-col.items-start');

async function playedCount(page: Page) {
  const value = await page
    .locator('dt', { hasText: /^Matches$/ })
    .locator('xpath=following-sibling::dd[1]')
    .innerText();
  return Number(value.replace(/\D/g, ''));
}

test.describe('Profile link to the match list', () => {
  test("another player's profile links to their matches", async ({ page }) => {
    await page.goto(`${LEAGUE}/player/${ALICE}`);

    const played = await playedCount(page);
    expect(played).toBeGreaterThan(1);
    const link = page.getByRole('link', { name: `All ${played} matches` });
    await expect(link).toHaveAttribute(
      'href',
      `${LEAGUE}/matches?player=${ALICE}`
    );
    // The profile no longer lists the matches itself.
    await expect(page.getByRole('heading', { name: 'Matches' })).toHaveCount(0);
  });

  test('your own profile links to your matches', async ({ page }) => {
    await page.goto(`${LEAGUE}/player/${ME}`);

    const played = await playedCount(page);
    await expect(
      page.getByRole('link', { name: `All ${played} matches` })
    ).toHaveAttribute('href', `${LEAGUE}/matches`);
  });
});

test.describe("A player's matches", () => {
  test('shows only their matches, with them first on every card', async ({
    page,
  }) => {
    await gotoAuthed(page, `${LEAGUE}/matches?player=${ALICE}`);

    await expect(playerPill(page)).toHaveText('Alice Anderson');
    // Your own week is not theirs, so it stays off this view.
    await expect(page.getByText('This week')).toHaveCount(0);
    const count = await leftColumns(page).count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(leftColumns(page).nth(i).locator('p').first()).toContainText(
        'alia'
      );
    }
  });

  test('Mine and Everyone leave the player view', async ({ page }) => {
    await gotoAuthed(page, `${LEAGUE}/matches?player=${ALICE}`);

    await whose(page).getByRole('link', { name: 'Everyone' }).click();
    await expect(page).toHaveURL(`${LEAGUE}/matches?view=everyone`);
    await expect(playerPill(page)).toHaveCount(0);
    // Everyone's feed is no longer Alice's alone.
    await expect(
      leftColumns(page).locator('p:first-child').filter({ hasNotText: 'alia' })
    ).not.toHaveCount(0);
  });

  test('your own id shows your matches', async ({ page }) => {
    await page.goto(`${LEAGUE}/matches?player=${ME}`);

    await expect(page).toHaveURL(`${LEAGUE}/matches`);
    await expect(playerPill(page)).toHaveCount(0);
    await expect(leftColumns(page).first().locator('p').first()).toContainText(
      'tuser'
    );
  });

  test('a teammate filter narrows their matches', async ({ page }) => {
    await page.goto(`${LEAGUE}/matches?player=${ALICE}`);
    const trigger = page.getByRole('combobox', { name: 'With', exact: true });
    await expect(async () => {
      await trigger.click();
      await expect(page.getByRole('listbox')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await page
      .getByRole('option')
      .filter({ hasNotText: 'Any teammate' })
      .first()
      .click();

    await expect(page).toHaveURL(new RegExp(`[?&]player=${ALICE}`));
    await expect(page).toHaveURL(/[?&]with=/);
    await expect(
      feed(page).getByText(/^\d+ match(es)? this season$/)
    ).toBeVisible();
    await expect(leftColumns(page).first().locator('p').first()).toContainText(
      'alia'
    );
  });

  test('an unknown player is a 404', async ({ page }) => {
    const response = await page.goto(
      `${LEAGUE}/matches?player=00000000-0000-0000-0000-000000000000`
    );
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByText('Player not found')).toBeVisible();
  });
});
