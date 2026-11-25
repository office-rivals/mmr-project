import { expect, test } from '@playwright/test';
import { gotoAuthed } from './helpers';

test('dialog close button is visible, accessible, and dismisses the dialog', async ({
  page,
}) => {
  await gotoAuthed(page, '/test-org/test-league');
  await page.getByRole('button', { name: 'Report match', exact: true }).click();

  const dialog = page.getByRole('dialog');
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await expect(dialog).toBeVisible();
  await expect(close).toBeVisible();

  await close.click();

  await expect(dialog).toBeHidden();
});
