import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import type { Scene } from './types';
const { expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const route =
  '/test-org/test-league/active-match/eeeeeeee-0000-0000-0000-000000000005';

export const playScenes: Scene[] = [
  {
    name: 'active-match-score-picker',
    route,
    open: async (page) => {
      await page.getByRole('button', { name: /We won/ }).click();
      await expect(page.locator('#score-step')).toBeVisible();
    },
  },
  {
    name: 'active-match-review',
    route,
    open: async (page) => {
      await page.getByRole('button', { name: /We won/ }).click();
      await page
        .locator('#score-step')
        .getByRole('button', { name: '5', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Submit the match', exact: true })
      ).toBeVisible();
    },
  },
];
