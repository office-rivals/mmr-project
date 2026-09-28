import playwright, {
  type Browser,
} from '../../frontend/node_modules/@playwright/test/index.js';
import { execFileSync } from 'node:child_process';

const { expect, test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const MATCHMAKING_PATH = '/test-org/pending-league/matchmaking';
const PENDING_MATCH_ID = 'eeeeeeee-3000-0000-0000-000000000020';

function resetPendingMatch() {
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
      stdio: ['pipe', 'pipe', 'pipe'],
      input: `
        BEGIN;
        DELETE FROM active_matches
          WHERE pending_match_id = '${PENDING_MATCH_ID}';
        DELETE FROM queue_entries
          WHERE league_id = 'eeeeeeee-3000-0000-0000-000000000001';
        UPDATE pending_matches
          SET status = 0, expires_at = now() + interval '7 days'
          WHERE id = '${PENDING_MATCH_ID}';
        UPDATE pending_match_acceptances
          SET status = CASE
                WHEN id IN (
                  'eeeeeeee-3000-0000-0000-000000000042',
                  'eeeeeeee-3000-0000-0000-000000000044'
                ) THEN 1
                ELSE 0
              END,
              accepted_at = CASE
                WHEN id IN (
                  'eeeeeeee-3000-0000-0000-000000000042',
                  'eeeeeeee-3000-0000-0000-000000000044'
                ) THEN now()
                ELSE NULL
              END
          WHERE pending_match_id = '${PENDING_MATCH_ID}';
        COMMIT;
      `,
    }
  );
}

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  const openPendingMatch = async (
    browser: Browser,
    projectUse: Parameters<Browser['newContext']>[0]
  ) => {
    resetPendingMatch();
    const context = await browser.newContext({ ...projectUse });
    const page = await context.newPage();
    const url = `http://localhost:${port}${MATCHMAKING_PATH}`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== MATCHMAKING_PATH) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }
    await expect(page).toHaveURL(url);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    if (app === 'beta') {
      await expect(page.locator('[data-dialog-close]')).toHaveCount(0);
    }
    await expect(dialog.getByText('⌛ pending', { exact: true })).toHaveCount(
      2
    );
    await expect(dialog.getByText('✅ accepted', { exact: true })).toHaveCount(
      2
    );
    return { context, dialog, page };
  };

  const recordsAction = (url: URL) =>
    app === 'reference'
      ? url.pathname === MATCHMAKING_PATH
      : url.pathname.startsWith('/_serverFn/');

  test(`${app}: accepting a pending match refreshes its acceptance state`, async ({
    browser,
  }, info) => {
    const { context, dialog, page } = await openPendingMatch(
      browser,
      info.project.use
    );
    const posts: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        recordsAction(new URL(request.url()))
      ) {
        posts.push(request.url());
      }
    });

    await dialog.getByRole('button', { name: 'Accept', exact: true }).click();

    await expect(
      dialog.getByText('Waiting for other players...', { exact: true })
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await expect(dialog.getByText('⌛ pending', { exact: true })).toHaveCount(
      1
    );
    await expect(dialog.getByText('✅ accepted', { exact: true })).toHaveCount(
      3
    );
    expect(posts).toHaveLength(1);
    await context.close();
  });

  test(`${app}: declining a pending match closes it and restores queueing`, async ({
    browser,
  }, info) => {
    const { context, dialog, page } = await openPendingMatch(
      browser,
      info.project.use
    );
    const posts: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        recordsAction(new URL(request.url()))
      ) {
        posts.push(request.url());
      }
    });

    await dialog.getByRole('button', { name: 'Decline', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Queue up/ })).toBeVisible();
    expect(posts).toHaveLength(1);
    await context.close();
  });
}
