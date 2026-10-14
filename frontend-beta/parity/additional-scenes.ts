import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import type { Scene } from './types';

const { expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const LEAGUE = '/test-org/test-league';
const PROFILE = `${LEAGUE}/player/66666666-6666-6666-6666-666666666601`;
const ADMIN_FLAGS = '/admin/test-org/leagues/test-league/match-flags';
const ADMIN_MEMBERS = '/admin/test-org/members';

async function openProfileFlagEditor(
  page: Parameters<NonNullable<Scene['open']>>[0]
) {
  await page.getByTitle('Edit flag', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Edit Flag', exact: true })
  ).toBeVisible();
}

async function openReportFlagEditor(
  page: Parameters<NonNullable<Scene['open']>>[0]
) {
  await page.getByRole('button', { name: 'Report match', exact: true }).click();
  const flaggedMatch = page
    .getByRole('dialog')
    .locator('button.border-red-400');
  await expect(flaggedMatch).toBeVisible();
  await flaggedMatch.click();
  await expect(
    page.getByRole('heading', { name: 'Edit flag', exact: true })
  ).toBeVisible();
}

export const additionalScenes: Scene[] = [
  {
    name: 'admin-resolve-flag-dialog',
    route: ADMIN_FLAGS,
    open: async (page) => {
      const card = page
        .getByTestId('match-flag-card')
        .filter({ hasText: 'Possible duplicate match entry (e2e B).' });
      await card.getByTestId('match-flag-resolve').click();
      await expect(
        page.getByRole('heading', { name: 'Resolve Match Flag' })
      ).toBeVisible();
    },
  },
  {
    name: 'admin-member-edit-form',
    route: ADMIN_MEMBERS,
    open: async (page) => {
      const member = page
        .getByText('Alice Anderson', { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
      await member.getByTitle('Edit profile', { exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Save', exact: true })
      ).toBeVisible();
    },
  },
  {
    name: 'profile-edit-flag-dialog',
    route: PROFILE,
    open: openProfileFlagEditor,
  },
  {
    name: 'profile-delete-flag-dialog',
    route: PROFILE,
    open: async (page) => {
      await openProfileFlagEditor(page);
      const editDialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Edit Flag', exact: true }),
      });
      await editDialog.getByRole('button', { name: 'Delete' }).click();
      await expect(
        page.getByRole('heading', { name: 'Delete Flag', exact: true })
      ).toBeVisible();
    },
  },
  {
    name: 'report-edit-flag-dialog',
    route: LEAGUE,
    open: openReportFlagEditor,
  },
  {
    name: 'report-delete-flag-dialog',
    route: LEAGUE,
    open: async (page) => {
      await openReportFlagEditor(page);
      const editDialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Edit flag', exact: true }),
      });
      await editDialog.getByRole('button', { name: 'Delete' }).click();
      await expect(
        page.getByRole('heading', { name: 'Delete flag', exact: true })
      ).toBeVisible();
    },
  },
];
