import { test, expect, type Page } from '@playwright/test';

// Covers the Hardware card on the league admin overview: Hardware
// Registration, Hardware Secret Rotation and Hardware Revocation.
//
// Seed facts: the test user is OWNER of Test Org (test-org); Test League
// (test-league) has no Hardware seeded. HardwareId is globally unique and
// Hardware is never deleted, so each run registers a fresh ID.

const LEAGUE_ADMIN = '/admin/test-org/leagues/test-league';
const SECRET = /^hw_[0-9a-f]{64}$/;

function uniqueHardwareId() {
  const hex = Date.now().toString(16).padStart(12, '0').slice(-12);
  return hex.match(/../g)!.join(':').toUpperCase();
}

// "Register Hardware" toggles the form client-side, so a click on the SSR'd
// button before hydration is lost. Retry until the form shows.
async function openRegisterForm(page: Page) {
  const input = page.getByLabel('Hardware ID');
  await expect(async () => {
    if (!(await input.isVisible())) {
      await page.getByRole('button', { name: 'Register Hardware' }).click();
    }
    await expect(input).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return input;
}

test('registers, rotates and revokes Hardware', async ({ page }) => {
  const hardwareId = uniqueHardwareId();
  await page.goto(LEAGUE_ADMIN);

  // Register → the Hardware Secret is shown with a copy button.
  const input = await openRegisterForm(page);
  await input.pressSequentially(hardwareId);
  await page.getByRole('button', { name: 'Register', exact: true }).click();

  const secret = page.getByTestId('hardware-secret');
  await expect(secret).toHaveText(SECRET);
  await expect(
    page.getByText("You won't be able to see it again")
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Copy Hardware Secret' })
  ).toBeVisible();
  const firstSecret = (await secret.textContent())!.trim();

  const row = page.getByTestId('hardware-row').filter({ hasText: hardwareId });
  await expect(row).toContainText('Never checked in');

  // Registering the same ID again surfaces the API's duplicate error inline.
  const again = await openRegisterForm(page);
  await again.pressSequentially(hardwareId);
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already registered');

  // Shown once: a fresh load no longer has the secret.
  await page.reload();
  await expect(row).toBeVisible();
  await expect(page.getByTestId('hardware-secret')).toHaveCount(0);
  // Hydration barrier: the confirm() guards below are client-side handlers;
  // before hydration the forms submit natively and no dialog fires.
  await openRegisterForm(page);

  // Rotate (behind a confirm) → a new, different secret is shown once.
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Rotate secret' }).click();
  await expect(secret).toHaveText(SECRET);
  expect((await secret.textContent())!.trim()).not.toBe(firstSecret);

  // Dismissing the revoke confirm leaves the Hardware active.
  page.once('dialog', (dialog) => dialog.dismiss());
  await row.getByRole('button', { name: 'Revoke' }).click();
  await expect(row.getByText('Revoked', { exact: true })).toHaveCount(0);

  // Revoke (behind a confirm) → shown as Revoked with no further actions.
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Revoke' }).click();
  await expect(row.getByText('Revoked', { exact: true })).toBeVisible();
  await expect(row.getByRole('button')).toHaveCount(0);
});
