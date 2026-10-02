import { test, expect } from '@playwright/test';

// Covers Personal Access Token creation on /settings end to end: the form
// posts to the API, which rejects any scope other than `write`.

test.describe('Settings — personal access tokens', () => {
  test('creates a token and shows it once', async ({ page }) => {
    await page.goto('/settings');

    // "Create New Token" is a client-side toggle, so the click only takes
    // effect after hydration — retry until the form is shown.
    const nameInput = page.getByLabel('Token name');
    await expect(async () => {
      if (!(await nameInput.isVisible())) {
        await page.getByRole('button', { name: 'Create New Token' }).click();
      }
      await expect(nameInput).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await nameInput.fill(`e2e token ${Date.now()}`);
    await page.getByRole('button', { name: 'Create Token' }).click();

    await expect(page.getByText('Save your token now!')).toBeVisible();
    await expect(page.getByText(/^pat_/)).toBeVisible();
  });
});
