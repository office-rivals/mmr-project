import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import type { Scene } from './types';
const { expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const league = '/test-org/empty-league';

export const emptyScenes: Scene[] = [
  {
    name: 'empty-profile',
    route: `${league}/player/eeeeeeee-0000-0000-0000-000000000006`,
  },
  {
    name: 'empty-player-stats-dialog',
    route: league,
    open: async (page) => {
      await page
        .getByRole('table')
        .first()
        .locator('tbody tr')
        .filter({ hasText: 'tuser' })
        .click();
      await expect(
        page.getByRole('dialog').getByText('No matches yet')
      ).toBeVisible();
    },
  },
  {
    name: 'empty-report-dialog',
    route: '/test-org/pending-league',
    open: async (page) => {
      await page
        .getByRole('button', { name: 'Report match', exact: true })
        .click();
      await expect(
        page.getByRole('dialog').getByText('No matches found')
      ).toBeVisible();
    },
  },
  { name: 'empty-admin-league', route: '/admin/test-org/leagues/empty-league' },
];
