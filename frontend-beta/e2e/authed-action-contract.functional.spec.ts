import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import { execFileSync } from 'node:child_process';
import { gotoAuthed } from './helpers';

const { expect, test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const ORG = '/test-org';
const LEAGUE = '/test-org/test-league';

test.beforeAll(() => {
  execFileSync(
    'psql',
    [
      '-h',
      process.env.E2E_DB_HOST ?? 'localhost',
      '-p',
      process.env.E2E_DB_PORT ?? '5433',
      '-U',
      process.env.E2E_DB_USER ?? 'postgres',
      '-d',
      process.env.E2E_DB_NAME ?? 'mmr_project',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: process.env.E2E_DB_PASS ?? 'this_is_a_hard_password1337',
      },
      input: `
        DELETE FROM league_players
        WHERE league_id = 'eeeeeeee-1000-0000-0000-000000000001';
        DELETE FROM leagues
        WHERE id = 'eeeeeeee-1000-0000-0000-000000000001';
        DELETE FROM organization_invite_links
        WHERE organization_id = 'eeeeeeee-1000-0000-0000-000000000002';
        DELETE FROM organization_memberships
        WHERE organization_id = 'eeeeeeee-1000-0000-0000-000000000002';
        DELETE FROM organizations
        WHERE id = 'eeeeeeee-1000-0000-0000-000000000002';

        INSERT INTO leagues (id, organization_id, name, slug, team_size, winning_score, created_at)
        VALUES ('eeeeeeee-1000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Native Fallback League', 'native-fallback-league', 1, 10, '2026-01-01')
        ;

        INSERT INTO organizations (id, name, slug, created_at)
        VALUES ('eeeeeeee-1000-0000-0000-000000000002', 'Native Invite Org', 'native-invite-org', '2026-01-01')
        ;
        INSERT INTO organization_memberships
          (id, organization_id, role, status, display_name, username, created_at)
        VALUES ('eeeeeeee-1000-0000-0000-000000000003', 'eeeeeeee-1000-0000-0000-000000000002', 0, 1, 'Invite Owner', 'invite-owner', '2026-01-01')
        ;
        INSERT INTO organization_invite_links
          (id, organization_id, code, created_by_membership_id, use_count, created_at)
        VALUES ('eeeeeeee-1000-0000-0000-000000000004', 'eeeeeeee-1000-0000-0000-000000000002', 'NATVEJYN2345', 'eeeeeeee-1000-0000-0000-000000000003', 0, '2026-01-01')
        ;
      `,
    }
  );
});

test.describe('native authenticated forms', () => {
  test.use({ javaScriptEnabled: false });

  test('organization settings POST and preserve private fields outside the URL', async ({
    page,
  }) => {
    await page.goto(`${ORG}/settings`);
    const form = page
      .getByRole('button', { name: 'Save Changes' })
      .locator('xpath=ancestor::form');
    const originalName = await form.getByLabel('Name').inputValue();

    const posted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `${ORG}/settings`
    );
    await form.getByRole('button', { name: 'Save Changes' }).click();

    expect((await posted).status()).toBe(303);
    await expect(page.getByRole('alert')).toHaveText(
      'Organization updated successfully'
    );
    expect(decodeURIComponent(page.url())).not.toContain(originalName);
  });

  test('joining a league works through native POST and redirect', async ({
    page,
  }) => {
    await page.goto(ORG);
    const card = page
      .getByText('Native Fallback League', { exact: true })
      .locator('xpath=ancestor::div[contains(@class, "rounded-lg")]');
    const form = card
      .getByRole('button', { name: 'Join League' })
      .locator('xpath=ancestor::form');

    const posted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === ORG
    );
    await form.getByRole('button', { name: 'Join League' }).click();

    expect((await posted).status()).toBe(303);
    await expect(page).toHaveURL(`${ORG}/native-fallback-league`);
    await expect(page.getByText(/League not found/i)).toHaveCount(0);
  });

  test('claiming an invite works through native POST and redirect', async ({
    page,
  }) => {
    await page.goto('/join/NATVEJYN2345');

    const posted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/join/NATVEJYN2345'
    );
    await page.getByRole('button', { name: 'Join Organization' }).click();

    expect((await posted).status()).toBe(303);
    await expect(page).toHaveURL('/native-invite-org');
    await expect(
      page.getByRole('heading', { name: 'Native Invite Org' })
    ).toBeVisible();
  });

  test('queue join and leave work through POST and PRG', async ({ page }) => {
    await page.goto(`${LEAGUE}/matchmaking`);

    const joinPosted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `${LEAGUE}/matchmaking`
    );
    await page.getByRole('button', { name: /Queue up/ }).click();
    expect((await joinPosted).status()).toBe(303);
    await expect(
      page.getByRole('button', { name: /Leave queue/ })
    ).toBeVisible();

    const leavePosted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `${LEAGUE}/matchmaking`
    );
    await page.getByRole('button', { name: /Leave queue/ }).click();
    expect((await leavePosted).status()).toBe(303);
    await expect(page.getByRole('button', { name: /Queue up/ })).toBeVisible();
  });
});

test('native mutation endpoints reject cross-origin posts', async ({
  page,
}) => {
  await page.goto('/settings');
  const response = await page.request.post('/settings', {
    headers: { origin: 'https://example.invalid' },
    form: { _action: 'revokeToken', tokenId: 'not-a-real-token' },
  });
  expect(response.status()).toBe(403);
});

test('server function validation keeps its HTTP failure status', async ({
  page,
}) => {
  await gotoAuthed(page, '/settings');
  await page.getByRole('button', { name: 'Create New Token' }).click();
  await page.getByLabel('Token Name').fill('   ');

  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.startsWith('/_serverFn/')
  );
  await page.getByRole('button', { name: 'Create Token' }).click();

  expect((await posted).status()).toBe(400);
  await expect(page.getByText('Token name is required')).toBeVisible();
});

test('an SSR token revoke form works before hydration', async ({
  browser,
}, testInfo) => {
  const tokenName = 'Native Revoke Token';
  const hydrated = await browser.newContext({
    ...testInfo.project.use,
    storageState: testInfo.project.use.storageState,
  });
  const hydratedPage = await hydrated.newPage();
  await gotoAuthed(hydratedPage, '/settings');
  await hydratedPage.getByRole('button', { name: 'Create New Token' }).click();
  await hydratedPage.getByLabel('Token Name').fill(tokenName);
  await hydratedPage.getByRole('button', { name: 'Create Token' }).click();
  await expect(
    hydratedPage.getByRole('row', { name: new RegExp(tokenName) })
  ).toBeVisible();
  const refreshedStorageState = await hydrated.storageState();
  await hydrated.close();

  const native = await browser.newContext({
    ...testInfo.project.use,
    javaScriptEnabled: false,
    storageState: refreshedStorageState,
  });
  const page = await native.newPage();
  await page.goto('/settings');
  const row = page.getByRole('row', { name: new RegExp(tokenName) });
  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/settings'
  );
  await row.getByRole('button', { name: 'Revoke' }).click();

  expect((await posted).status()).toBe(303);
  await expect(
    page.getByRole('row', { name: new RegExp(tokenName) })
  ).toHaveCount(0);
  await native.close();
});
