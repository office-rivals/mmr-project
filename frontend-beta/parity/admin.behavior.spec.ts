import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import type {
  Browser,
  TestInfo,
} from '../../frontend/node_modules/@playwright/test/index.js';

const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const MEMBERS = '/admin/test-org/members';
const MATCHES = '/admin/test-org/leagues/test-league/matches';
const FLAGS = '/admin/test-org/leagues/test-league/match-flags';

function serverFnExport(pathname: string): string {
  try {
    const encoded = pathname.split('/').pop() ?? '';
    return (
      (
        JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
          export?: string;
        }
      ).export ?? ''
    );
  } catch {
    return '';
  }
}

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  const openPage = async (browser: Browser, info: TestInfo, path: string) => {
    const context = await browser.newContext({ ...info.project.use });
    const page = await context.newPage();
    const url = `http://localhost:${port}${path}`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== path) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }
    return { context, page };
  };

  test(`${app}: a successful email invite resets the submitted fields`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, MEMBERS);
    const form = page
      .getByRole('button', { name: 'Invite', exact: true })
      .locator('xpath=ancestor::form');
    const email = form.getByLabel('Email');
    const role = form.getByLabel('Role');
    const displayName = form.getByLabel('Display name (optional)');
    const username = form.getByLabel('Username (optional)');

    const identity = `enhance-reset-${app}-${info.retry}`;
    await email.fill(`${identity}@example.com`);
    await role.selectOption('Moderator');
    await displayName.fill(`Enhanced Reset ${app} ${info.retry}`);
    await username.fill(identity);
    await form.getByRole('button', { name: 'Invite', exact: true }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Member invited successfully' })
    ).toBeVisible();
    await expect(email).toHaveValue('');
    await expect(role).toHaveValue('Member');
    await expect(displayName).toHaveValue('');
    await expect(username).toHaveValue('');
    await context.close();
  });

  test(`${app}: email invite fields reset before the data reload finishes`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, MEMBERS);
    let releaseReload: () => void = () => {};
    let markReloadStarted: () => void = () => {};
    const reloadGate = new Promise<void>(
      (resolve) => (releaseReload = resolve)
    );
    const reloadStarted = new Promise<void>(
      (resolve) => (markReloadStarted = resolve)
    );
    await page.route(
      (url) =>
        app === 'reference'
          ? url.pathname.includes('__data.json')
          : serverFnExport(url.pathname).startsWith('loadMembersFn'),
      async (route) => {
        markReloadStarted();
        await reloadGate;
        await route.continue();
      }
    );

    const form = page
      .getByRole('button', { name: 'Invite', exact: true })
      .locator('xpath=ancestor::form');
    const email = form.getByLabel('Email');
    const role = form.getByLabel('Role');
    const displayName = form.getByLabel('Display name (optional)');
    const username = form.getByLabel('Username (optional)');
    const identity = `stalled-reset-${app}-${info.retry}`;
    await email.fill(`${identity}@example.com`);
    await role.selectOption('Moderator');
    await displayName.fill(`Stalled Reset ${app} ${info.retry}`);
    await username.fill(identity);
    await form.getByRole('button', { name: 'Invite', exact: true }).click();

    await reloadStarted;
    try {
      await expect(email).toHaveValue('');
      await expect(role).toHaveValue('Member');
      await expect(displayName).toHaveValue('');
      await expect(username).toHaveValue('');
      await expect(
        page
          .getByRole('alert')
          .filter({ hasText: 'Member invited successfully' })
      ).toHaveCount(0);
    } finally {
      releaseReload();
    }

    await expect(
      page.getByRole('alert').filter({ hasText: 'Member invited successfully' })
    ).toBeVisible();
    await context.close();
  });

  test(`${app}: match action feedback clears when changing pages`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, MATCHES);
    const feedback = page.getByRole('alert').filter({
      hasText: /Recalculated\s+\d+\s+match/,
    });

    await page.getByTestId('admin-match-recalculate').first().click();
    await expect(feedback).toBeVisible();
    await page.getByRole('link', { name: 'Older' }).click();
    await expect(page).toHaveURL(/\?offset=25$/);
    await expect(feedback).toHaveCount(0);
    await context.close();
  });

  test(`${app}: success feedback waits for the refreshed match data`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, MATCHES);
    let releaseReload: () => void = () => {};
    let markReloadStarted: () => void = () => {};
    const reloadGate = new Promise<void>(
      (resolve) => (releaseReload = resolve)
    );
    const reloadStarted = new Promise<void>(
      (resolve) => (markReloadStarted = resolve)
    );
    await page.route(
      (url) =>
        app === 'reference'
          ? url.pathname.includes('__data.json')
          : serverFnExport(url.pathname).startsWith('loadMatchesFn'),
      async (route) => {
        markReloadStarted();
        await reloadGate;
        await route.continue();
      }
    );
    const feedback = page.getByRole('alert').filter({
      hasText: /Recalculated\s+\d+\s+match/,
    });

    await page.getByTestId('admin-match-recalculate').first().click();
    await reloadStarted;
    try {
      await expect(feedback).toHaveCount(0);
    } finally {
      releaseReload();
    }
    await expect(feedback).toBeVisible();
    await context.close();
  });

  test(`${app}: flag action feedback clears when changing filters`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, FLAGS);
    const feedback = page.getByRole('alert').filter({
      hasText: /Recalculated\s+\d+\s+match/,
    });
    page.once('dialog', (dialog) => void dialog.accept());

    await page
      .locator('[data-testid="match-flag-recalculate"]:not(:disabled)')
      .first()
      .click();
    await expect(feedback).toBeVisible();
    await page.getByRole('link', { name: 'Resolved', exact: true }).click();
    await expect(page).toHaveURL(/\?status=Resolved$/);
    await expect(feedback).toHaveCount(0);
    await context.close();
  });
}
