import playwright from '../../frontend/node_modules/@playwright/test/index.js';
const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const betaUrl = `http://localhost:${process.env.PARITY_BETA_PORT ?? '5181'}`;

test('season picker supports keyboard selection', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    ...testInfo.project.use,
    storageState: testInfo.project.use.storageState,
  });
  const page = await context.newPage();
  await page.goto(`${betaUrl}/test-org/test-league`);

  const trigger = page.getByRole('button', { name: 'Select a season' });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await trigger.press('ArrowDown');

  const listbox = page.getByRole('listbox', { name: 'Select a season' });
  await expect(listbox).toBeVisible();
  await expect(
    listbox.getByRole('option', { name: 'Current Season' })
  ).toBeFocused();

  await page.keyboard.press('End');
  await expect(listbox.getByRole('option').last()).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(listbox).toBeHidden();
  await expect(trigger).toHaveText(/Season \d+/);
  await expect(trigger).toBeFocused();

  await trigger.press('ArrowDown');
  await expect(listbox).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.press('ArrowDown');
  await page.keyboard.press('s');
  await expect(listbox.getByRole('option', { name: 'Season 2' })).toBeFocused();
  await page.keyboard.press('s');
  await expect(listbox.getByRole('option', { name: 'Season 1' })).toBeFocused();

  await page.keyboard.press('Home');
  const firstOption = listbox.getByRole('option').first();
  await expect(firstOption).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(firstOption).toBeFocused();
  await context.close();
});
