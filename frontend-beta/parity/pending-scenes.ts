import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import type { Scene } from './types';

const { expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

export const pendingScenes: Scene[] = [
  {
    name: 'pending-match-dialog',
    route: '/test-org/pending-league/matchmaking',
    mask: ['[data-parity-mask]'],
    open: async (page) => {
      await expect(
        page.getByRole('heading', { name: 'Match found!' })
      ).toBeVisible();
      const countdown = page.getByText(/^Accept within \d+s$/);
      await expect(countdown).toBeVisible();
      await countdown.evaluate((element) =>
        element.setAttribute('data-parity-mask', '')
      );
    },
  },
];
