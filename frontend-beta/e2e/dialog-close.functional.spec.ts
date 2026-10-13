import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import { gotoAuthed } from './helpers';

const { expect, test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

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
