import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import type {
  Browser,
  TestInfo,
} from '../../frontend/node_modules/@playwright/test/index.js';

const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const TEST_LEAGUE = '/test-org/test-league';
const PROFILE = `${TEST_LEAGUE}/player/66666666-6666-6666-6666-666666666601`;

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  const openPage = async (browser: Browser, info: TestInfo, path: string) => {
    const context = await browser.newContext({ ...info.project.use });
    const page = await context.newPage();
    const url = `http://localhost:${port}${path}`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== path) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }
    return { context, page };
  };

  test(`${app}: season picker keeps focus on its trigger while navigating`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, TEST_LEAGUE);
    const trigger = page.getByRole('button', { name: 'Select a season' });
    await expect(trigger).toBeEnabled();
    await trigger.focus();
    await trigger.press('ArrowDown');

    const listbox = page.getByRole('listbox');
    const highlighted = listbox.locator('[role="option"][data-highlighted]');
    await expect(listbox).toBeVisible();
    await expect(highlighted).toHaveCount(1);
    await expect(highlighted).toHaveAttribute('id', /.+/);
    await expect(trigger).toBeFocused();
    expect(await trigger.getAttribute('aria-activedescendant')).toBe(
      await highlighted.getAttribute('id')
    );

    await trigger.press('End');
    const lastOption = listbox.getByRole('option').last();
    const lastLabel = (await lastOption.innerText()).trim();
    await expect(lastOption).toHaveAttribute('data-highlighted', '');
    await trigger.press('Enter');
    await expect(listbox).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toContainText(lastLabel);
    await context.close();
  });

  test(`${app}: touch selection keeps the synthetic click on the season option`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      ...info.project.use,
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const url = `http://localhost:${port}${TEST_LEAGUE}`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== TEST_LEAGUE) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }

    const trigger = page.getByRole('button', { name: 'Select a season' });
    await expect(trigger).toBeEnabled();
    await trigger.tap();
    const listbox = page.getByRole('listbox');
    const option = listbox.getByRole('option').last();
    const label = (await option.innerText()).trim();
    await expect(option).toBeVisible();

    await page.evaluate(() => {
      const state = window as typeof window & {
        __seasonClickTargets?: boolean[];
      };
      state.__seasonClickTargets = [];
      document.addEventListener(
        'click',
        (event) => {
          const target = event.target;
          state.__seasonClickTargets?.push(
            target instanceof Element &&
              target.closest('[role="option"]') !== null
          );
        },
        { capture: true }
      );
    });

    await option.tap();

    await expect(listbox).toBeHidden();
    await expect(trigger).toContainText(label);
    await expect(page).toHaveURL(/\?season=/);
    expect(
      await page.evaluate(
        () =>
          (
            window as typeof window & {
              __seasonClickTargets?: boolean[];
            }
          ).__seasonClickTargets
      )
    ).toEqual([true]);
    await context.close();
  });

  test(`${app}: player picker follows its initial and pointer highlights`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, PROFILE);
    const input = page.locator('input[placeholder="Filter..."]').first();
    await input.fill('ro');

    const listbox = page.getByRole('listbox');
    const options = listbox.getByRole('option');
    await expect(options.nth(1)).toBeVisible();
    await expect(options.first()).toHaveAttribute('data-highlighted', '');

    await input.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('data-highlighted', '');

    await options.first().hover();
    await expect(options.first()).toHaveAttribute('data-highlighted', '');
    expect(await input.getAttribute('aria-activedescendant')).toBe(
      await options.first().getAttribute('id')
    );

    await input.press('End');
    const firstOption = options.first();
    const lastOption = options.last();
    await expect(lastOption).toHaveAttribute('data-highlighted', '');
    await input.press('ArrowDown');
    await expect(firstOption).toHaveAttribute('data-highlighted', '');
    await input.press('Home');
    await expect(firstOption).toHaveAttribute('data-highlighted', '');
    await input.press('ArrowUp');
    await expect(lastOption).toHaveAttribute('data-highlighted', '');
    await context.close();
  });

  test(`${app}: player picker dismisses on Tab and outside interaction`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, PROFILE);
    const input = page.locator('input[placeholder="Filter..."]').first();
    const listbox = page.getByRole('listbox');

    await input.fill('ro');
    await expect(listbox).toBeVisible();
    await input.press('Tab');
    await expect(listbox).toBeHidden();

    await input.focus();
    await expect(listbox).toBeVisible();
    await page.locator('main h1').first().click();
    await expect(listbox).toBeHidden();
    await context.close();
  });

  test(`${app}: tapping a player option leaves the selected filter in place`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      ...info.project.use,
      hasTouch: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const url = `http://localhost:${port}${PROFILE}`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== PROFILE) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }

    const input = page.locator('input[placeholder="Filter..."]').first();
    await input.fill('ro');
    const listbox = page.getByRole('listbox');
    const option = listbox.getByRole('option').first();
    const playerName = (await option.locator('p').first().innerText()).trim();
    await option.tap();

    await expect(listbox).toBeHidden();
    await expect(input).toHaveValue('');
    await expect(
      page
        .locator('div.flex.items-center.space-x-2.rounded-md.bg-secondary')
        .filter({ hasText: playerName })
    ).toBeVisible();
    await expect(page).toHaveURL(url);
    await context.close();
  });

  test(`${app}: opening a new-player dialog preserves its source suggestions`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(
      browser,
      info,
      `${TEST_LEAGUE}/submit`
    );
    const input = page.locator('input[placeholder="Filter..."]').first();
    await input.fill('zzzzznoplayer');
    const noPlayers = page.getByText('No players found', { exact: true });
    await expect(noPlayers).toBeVisible();

    await page
      .getByRole('button', { name: 'Add new player', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(noPlayers).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(noPlayers).toBeVisible();
    await context.close();
  });

  test(`${app}: disabled pagination links are inert and leave the tab order`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(
      browser,
      info,
      '/admin/test-org/leagues/test-league/matches'
    );
    const newer = page.getByRole('link', { name: 'Newer' });
    await expect(newer).toHaveAttribute('aria-disabled', 'true');
    await expect(newer).toHaveAttribute('tabindex', '-1');
    await expect(newer).not.toHaveAttribute('href', /.+/);
    await context.close();
  });
}
