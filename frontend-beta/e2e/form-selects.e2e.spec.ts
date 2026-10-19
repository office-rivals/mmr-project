// The form selects: each picks by mouse or keyboard and carries its value in
// the form through Base UI's hidden input.
import { test, expect, type Page } from '@playwright/test';

const LEAGUE = '/test-org/test-league';
const MEMBERS = '/admin/test-org/members';
const ADMIN_MATCHES = '/admin/test-org/leagues/test-league/matches';

// Admin controls render before hydration wires them up; a click in that
// window is swallowed, so retry until the popup opens.
async function openSelect(page: Page, name: string) {
  const trigger = page.getByRole('combobox', { name, exact: true });
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return trigger;
}

test('the matches partner filter narrows by teammate and clears', async ({
  page,
}) => {
  await page.goto(`${LEAGUE}/matches`);
  const trigger = await openSelect(page, 'With');
  const teammates = page
    .getByRole('option')
    .filter({ hasNotText: 'Any teammate' });
  const name = (await teammates.first().textContent())!.trim();
  await teammates.first().click();

  await expect(page).toHaveURL(/[?&]with=/);
  await expect(trigger).toHaveText(new RegExp(name));

  await trigger.click();
  await page
    .getByRole('listbox')
    .getByRole('option', { name: 'Any teammate' })
    .click();
  await expect(page).not.toHaveURL(/[?&]with=/);
  await expect(trigger).toHaveText(/Any teammate/);
});

test('a member row changes role from its select', async ({ page }) => {
  await page.goto(MEMBERS);
  const name = 'Role for Alice Anderson';
  const trigger = page.getByRole('combobox', { name, exact: true });
  const original = (await trigger.textContent())!.trim();
  const next = original === 'Member' ? 'Moderator' : 'Member';
  const pick = async (role: string) => {
    await openSelect(page, name);
    await page
      .getByRole('listbox')
      .getByRole('option', { name: role, exact: true })
      .click();
    await expect(trigger).toHaveText(role);
  };

  try {
    await pick(next);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Role updated successfully' })
    ).toBeVisible();
    await page.reload();
    await expect(trigger).toHaveText(next);
  } finally {
    await pick(original);
  }
});

test('the create-league format is picked by keyboard and posted', async ({
  page,
}) => {
  await page.goto('/admin/test-org/leagues');
  await expect(async () => {
    await page.getByRole('button', { name: 'New league' }).click();
    await expect(page.getByLabel('Format')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  const form = page
    .getByRole('button', { name: 'Create league' })
    .locator('xpath=ancestor::form');
  await expect(form.locator('input[name="teamSize"]')).toHaveValue('2');

  const trigger = page.getByRole('combobox', { name: 'Format' });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  // The list highlights the current value before it takes focus; a key sent
  // in between still reaches the trigger and is lost.
  const listbox = page.getByRole('listbox');
  await expect(listbox.getByRole('option', { name: '2v2' })).toHaveAttribute(
    'data-highlighted',
    ''
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => !!document.activeElement?.closest('[data-slot="select-content"]')
      )
    )
    .toBe(true);
  await page.keyboard.press('ArrowDown');
  await expect(listbox.getByRole('option', { name: '1v1' })).toHaveAttribute(
    'data-highlighted',
    ''
  );
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveText('1v1');
  await expect(trigger).toBeFocused();
  await expect(form.locator('input[name="teamSize"]')).toHaveValue('1');
});

test('the edit-match dialog swaps a player and flags a duplicate', async ({
  page,
}) => {
  await page.goto(ADMIN_MATCHES);
  const dialog = page.getByRole('dialog');
  await expect(async () => {
    await page.getByTestId('admin-match-edit').first().click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  const first = dialog.locator('#team-0-player-0');
  const other = (await dialog
    .locator('#team-1-player-0')
    .textContent())!.trim();
  await first.click();
  await page
    .getByRole('listbox')
    .getByRole('option', { name: other, exact: true })
    .click();
  await expect(first).toHaveText(other);
  await expect(
    dialog.getByText('Each player can only appear once across both teams.')
  ).toBeVisible();

  // Picking a value inside the dialog must not close it.
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});
