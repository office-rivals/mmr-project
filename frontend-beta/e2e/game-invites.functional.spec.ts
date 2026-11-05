import { expect, test } from '@playwright/test';

const PLAY_URL = '/test-org/test-league/matchmaking';

test.describe('game invite native forms', () => {
  // The invite is per signed-in player; always leave the league clean. Cancel
  // needs JavaScript, so cleanup runs in the default (hydrated) page.
  test.afterEach(async ({ page }) => {
    await page.goto(PLAY_URL);
    const cancel = page.getByRole('button', { name: 'Cancel invite' });
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
      await expect(
        page.getByRole('button', { name: 'Create game invite' })
      ).toBeVisible();
    }
  });

  test('Create works through native POST and redirect', async ({
    browser,
  }, testInfo) => {
    const native = await browser.newContext({
      ...testInfo.project.use,
      javaScriptEnabled: false,
    });
    const page = await native.newPage();
    await page.goto(PLAY_URL);

    const posted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === PLAY_URL
    );
    await page.getByRole('button', { name: 'Create game invite' }).click();

    expect((await posted).status()).toBe(303);
    await expect(page).toHaveURL(PLAY_URL);
    await expect(page.getByLabel('Invite link')).toHaveValue(
      /\/game-invites\/[A-Za-z0-9]+$/
    );
    await native.close();
  });

  test('the shared-link join POST rejects a forged origin and unknown actions', async ({
    page,
  }) => {
    const path = '/game-invites/ABCDEF123';
    await page.goto(PLAY_URL);
    const { origin } = new URL(page.url());

    const forged = await page.request.post(path, {
      form: { _action: 'join' },
      headers: { origin: 'https://attacker.example' },
    });
    expect(forged.status()).toBe(403);

    const unknown = await page.request.post(path, {
      form: { _action: 'nope' },
      headers: { origin },
    });
    expect(unknown.status()).toBe(400);
  });
});
