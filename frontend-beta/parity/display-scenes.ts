import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import type { Scene } from './types';
const { expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const route = '/test-org/test-league';

export const displayScenes: Scene[] = [
  {
    name: 'leaderboard-mmr',
    route,
    open: async (page) => {
      const toggle = page.locator('button[role=checkbox]#show-mmr');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
    },
  },
  {
    name: 'leaderboard-previous-season',
    route,
    open: async (page) => {
      await page.getByLabel('Select a season').click();
      await page.getByRole('option', { name: 'Season 1', exact: true }).click();
      await expect(page.getByLabel('Select a season')).toHaveText(/Season 1/);
      await page.waitForLoadState('networkidle');
    },
  },
];
