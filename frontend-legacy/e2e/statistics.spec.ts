import { test, expect } from '@playwright/test';

test('statistics page renders line chart and heatmap', async ({ page }) => {
  await page.goto('/test-org/test-league/statistics');

  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();

  const charts = page.locator('.bx--chart-holder, .cds--chart-holder');
  // Carbon line chart + heatmap → expect ≥ 2 chart containers.
  await expect(charts.first()).toBeVisible({ timeout: 15_000 });
  await expect(charts).toHaveCount(2, { timeout: 15_000 });

  await expect(page.getByText('Match frequency')).toBeVisible();
});
