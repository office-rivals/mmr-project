import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import { gotoAuthed } from './helpers';
const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

test('season picker supports keyboard selection', async ({ page }) => {
  await gotoAuthed(page, '/test-org/test-league');

  const trigger = page.getByRole('button', { name: 'Select a season' });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await trigger.press('ArrowDown');

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const current = listbox.getByRole('option', { name: 'Current Season' });
  await expect(trigger).toBeFocused();
  expect(await trigger.getAttribute('aria-activedescendant')).toBe(
    await current.getAttribute('id')
  );

  await trigger.press('End');
  const last = listbox.getByRole('option').last();
  await expect(last).toHaveAttribute('data-highlighted', '');
  expect(await trigger.getAttribute('aria-activedescendant')).toBe(
    await last.getAttribute('id')
  );
  await trigger.press('Enter');

  await expect(listbox).toBeHidden();
  await expect(trigger).toHaveText(/Season \d+/);
  await expect(trigger).toBeFocused();

  await trigger.press('ArrowDown');
  await expect(listbox).toBeVisible();
  await trigger.press('Escape');
  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.press('ArrowDown');
  await trigger.press('s');
  await expect(
    listbox.getByRole('option', { name: 'Season 2' })
  ).toHaveAttribute('data-highlighted', '');
  await trigger.press('s');
  await expect(
    listbox.getByRole('option', { name: 'Season 1' })
  ).toHaveAttribute('data-highlighted', '');

  await trigger.press('Home');
  const firstOption = listbox.getByRole('option').first();
  await expect(firstOption).toHaveAttribute('data-highlighted', '');
  await trigger.press('ArrowUp');
  await expect(firstOption).toHaveAttribute('data-highlighted', '');
  await expect(trigger).toBeFocused();
});
