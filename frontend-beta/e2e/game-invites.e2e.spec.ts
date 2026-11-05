import { test, expect, type Page } from '@playwright/test';

const PLAY_URL = '/test-org/test-league/matchmaking';

const createButton = (page: Page) =>
  page.getByRole('button', { name: 'Create game invite' });
const cancelButton = (page: Page) =>
  page.getByRole('button', { name: 'Cancel invite' });

test.describe('Game invites', () => {
  // The invite is per signed-in player; always leave the league clean.
  test.afterEach(async ({ page }) => {
    await page.goto(PLAY_URL);
    if (
      await cancelButton(page)
        .isVisible()
        .catch(() => false)
    ) {
      await cancelButton(page).click();
      await expect(createButton(page)).toBeVisible();
    }
  });

  test('creates an invite with a shareable link and a roster', async ({
    page,
  }) => {
    await page.goto(PLAY_URL);
    await createButton(page).click();

    const link = page.getByLabel('Invite link');
    await expect(link).toHaveValue(/\/game-invites\/[A-Za-z0-9]+$/);
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect(page.getByText('You', { exact: true })).toBeVisible();
    await expect(page.getByText('Creator')).toBeVisible();
    await expect(page.getByText(/spots? left/)).toBeVisible();
  });

  test('keeps the invite across a reload', async ({ page }) => {
    await page.goto(PLAY_URL);
    await createButton(page).click();
    await expect(page.getByLabel('Invite link')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Invite link')).toBeVisible();
  });

  test('blocks queueing while in an invite', async ({ page }) => {
    await page.goto(PLAY_URL);
    await createButton(page).click();

    await expect(page.getByText(/You.re in a game invite/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Queue up/ })).toHaveCount(0);
  });

  test('cancelling returns the page to the create action', async ({ page }) => {
    await page.goto(PLAY_URL);
    await createButton(page).click();
    await cancelButton(page).click();

    await expect(
      page.getByText('The creator cancelled this game invite.')
    ).toBeVisible();
    await expect(createButton(page)).toBeVisible();
    await expect(page.getByLabel('Invite link')).toHaveCount(0);
  });

  test('adds a league player to a spot and removes them again', async ({
    page,
  }) => {
    await page.goto(PLAY_URL);
    await createButton(page).click();

    const picker = page.getByRole('region', { name: 'Add league players' });
    await picker.getByRole('button', { pressed: false }).first().click();
    await page.getByRole('button', { name: 'Add 1 player' }).click();

    const removeButtons = page.getByRole('button', { name: /^Remove / });
    await expect(removeButtons).toHaveCount(1);

    await removeButtons.first().click();
    await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(0);
  });

  test('a shared link for an unknown code shows a no-match message', async ({
    page,
  }) => {
    await page.goto('/game-invites/NOSUCHCODE1');
    await expect(
      page.getByText("This invite link doesn't match an open game.")
    ).toBeVisible();
  });
});

test.describe('Game invite sign-in return', () => {
  // Signed out: the guard must send the visitor to sign-in with the invite as
  // the only allowed return target.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a logged-out visitor returns to the invite after sign-in', async ({
    page,
  }) => {
    await page.goto('/game-invites/ABCDEF123');
    await expect(page).toHaveURL(
      /\/login\?returnTo=%2Fgame-invites%2FABCDEF123$/
    );
  });

  test('completing sign-in lands on the invite, not home', async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    if (!email || !password) throw new Error('E2E credentials are not set');

    await page.goto('/game-invites/ABCDEF123');
    await page.locator('input[name=identifier]').fill(email);
    await page.locator('input[name=identifier]').press('Enter');
    await page.locator('input[name=password]').fill(password);
    await page.locator('input[name=password]').press('Enter');

    await expect(page).toHaveURL(/\/game-invites\/ABCDEF123$/, {
      timeout: 15_000,
    });
  });
});
