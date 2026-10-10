import { test, expect } from '@playwright/test';

// Covers the RFID pairing card on /settings: issuing a Pairing Code shows its
// color sequence. Submitting the code is device-only (Hardware Secret), so the
// API integration tests cover the rest of the flow.

test.describe('Settings — RFID pairing', () => {
  test('generates a pairing code as a color sequence', async ({ page }) => {
    await page.goto('/settings#pairing');

    await page.getByRole('button', { name: 'Generate pairing code' }).click();

    await expect(page.getByText('Pairing code', { exact: true })).toBeVisible();
    await expect(page.getByText(/^1\. (Red|Green|Blue|Yellow)$/)).toBeVisible();
    await expect(page.getByText(/^Expires /)).toBeVisible();
  });
});
