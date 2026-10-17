import { expect, test } from '@playwright/test';
import { gotoAuthed } from './helpers';

test('season picker supports keyboard selection', async ({ page }) => {
  await gotoAuthed(page, '/test-org/test-league');

  const trigger = page.getByRole('combobox', { name: 'Select a season' });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press('ArrowDown');

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await expect(
    listbox.getByRole('option', { name: 'Current Season' })
  ).toHaveAttribute('data-highlighted', '');

  await page.keyboard.press('End');
  const last = listbox.getByRole('option').last();
  await expect(last).toHaveAttribute('data-highlighted', '');
  await page.keyboard.press('Enter');

  await expect(listbox).toBeHidden();
  await expect(trigger).toHaveText(/Season \d+/);
  await expect(trigger).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(listbox).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('s');
  await expect(
    listbox.getByRole('option', { name: 'Season 2' })
  ).toHaveAttribute('data-highlighted', '');

  await page.keyboard.press('Home');
  const firstOption = listbox.getByRole('option').first();
  await expect(firstOption).toHaveAttribute('data-highlighted', '');
  await page.keyboard.press('ArrowUp');
  await expect(firstOption).toHaveAttribute('data-highlighted', '');
});
