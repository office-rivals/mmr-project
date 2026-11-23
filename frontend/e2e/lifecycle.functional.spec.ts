import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { gotoAuthed } from './helpers';

const LEAGUE_ID = 'eeeeeeee-1000-0000-0000-000000000005';
const LATE_LEAGUE_ID = 'eeeeeeee-1000-0000-0000-000000000006';

test.use({ hasTouch: true });

function runSql(input: string) {
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
      input,
    }
  );
}

test.beforeAll(() => {
  runSql(`
    INSERT INTO leagues (id, organization_id, name, slug, team_size, winning_score, created_at)
    VALUES ('${LEAGUE_ID}', '11111111-1111-1111-1111-111111111111', 'Hydrated Fresh League', 'hydrated-fresh-league', 1, 10, '2026-01-01')
    ON CONFLICT (id) DO NOTHING;
  `);
});

test('hydrated league join replaces the inactive shell cache before navigation', async ({
  page,
}) => {
  await gotoAuthed(page, '/test-org');
  const form = page.locator('form').filter({
    has: page.locator(`input[name="leagueId"][value="${LEAGUE_ID}"]`),
  });

  const enhancedPost = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.startsWith('/_serverFn/')
  );
  await form.getByRole('button', { name: 'Join League' }).click();
  expect((await enhancedPost).status()).toBeLessThan(400);

  await expect(page).toHaveURL('/test-org/hydrated-fresh-league');
  await expect(page.getByText(/League not found/i)).toHaveCount(0);
});

test('revisiting a warmed organization refetches its league list', async ({
  page,
}) => {
  runSql(`DELETE FROM leagues WHERE id = '${LATE_LEAGUE_ID}';`);
  await gotoAuthed(page, '/test-org');
  await expect(
    page.getByText('League Added After Load', { exact: true })
  ).toHaveCount(0);

  runSql(`
    INSERT INTO leagues (id, organization_id, name, slug, team_size, winning_score, created_at)
    VALUES ('${LATE_LEAGUE_ID}', '11111111-1111-1111-1111-111111111111', 'League Added After Load', 'league-added-after-load', 1, 10, '2026-01-01');
  `);
  await page.getByRole('link', { name: 'Open League' }).first().click();
  await expect(page).toHaveURL(/\/test-org\/[^/]+$/);
  await page.goBack();

  await expect(page).toHaveURL('/test-org');
  await expect(
    page.getByText('League Added After Load', { exact: true })
  ).toBeVisible();
});

async function markStandalone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      configurable: true,
    });
  });
}

async function pull(client: CDPSession) {
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 180, y: 90 }],
  });
  for (let step = 1; step <= 14; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 180, y: 90 + Math.round((290 * step) / 14) }],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

test('pull-to-refresh reports a failed refetch', async ({ page }) => {
  await markStandalone(page);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'hover', value: 'none' },
      { name: 'pointer', value: 'coarse' },
    ],
  });
  await gotoAuthed(page, '/test-org/test-league');
  await expect(page.getByLabel('Settings menu')).toBeVisible();
  await page.waitForTimeout(400);

  let abortedRpc = false;
  await page.route(
    (url) => url.pathname.startsWith('/_serverFn/'),
    (route) => {
      abortedRpc = true;
      return route.abort();
    }
  );
  await pull(client);

  await expect(page.locator('[role="status"].fixed')).toContainText(
    'Refresh failed'
  );
  expect(abortedRpc).toBe(true);
});

test('pull-to-refresh redirects when the session has expired', async ({
  page,
}) => {
  await markStandalone(page);
  const client = await page.context().newCDPSession(page);
  await gotoAuthed(page, '/test-org/test-league');
  await expect(page.getByLabel('Settings menu')).toBeVisible();
  await page.waitForTimeout(400);
  await page.context().clearCookies();

  await pull(client);

  await expect(page).toHaveURL('/login');
  await expect(page.getByText('Refresh failed', { exact: true })).toHaveCount(
    0
  );
});

const NEWER_MATCH_ID = 'eeeeeeee-1000-0000-0000-000000000010';

test.afterAll(() => {
  runSql(`
    DELETE FROM match_team_players WHERE match_team_id IN (
      SELECT id FROM match_teams WHERE match_id = '${NEWER_MATCH_ID}');
    DELETE FROM match_teams WHERE match_id = '${NEWER_MATCH_ID}';
    DELETE FROM matches WHERE id = '${NEWER_MATCH_ID}';
  `);
});

test('pull-to-refresh keeps the older matches already loaded in order', async ({
  page,
}) => {
  // Regression: only page 1 reloaded, so a newer match pushed one loaded row
  // out of the list and the next page repeated another.
  await markStandalone(page);
  const client = await page.context().newCDPSession(page);
  await gotoAuthed(page, '/test-org/test-league/matches');
  const playedAt = page.locator(
    'section[aria-label="Match feed"] time[datetime]'
  );
  const shown = () =>
    playedAt.evaluateAll((times) =>
      times.map((time) => time.getAttribute('datetime'))
    );
  await expect(playedAt).toHaveCount(20);
  await page.getByRole('button', { name: 'Load older matches' }).click();
  await expect(playedAt).toHaveCount(40);
  const before = await shown();

  runSql(`
    INSERT INTO matches (id, organization_id, league_id, season_id, source, created_by_membership_id, played_at, recorded_at, created_at)
    SELECT '${NEWER_MATCH_ID}', organization_id, league_id, id, 0, '55555555-5555-5555-5555-555555555501', now(), now(), now()
    FROM seasons WHERE league_id = '22222222-2222-2222-2222-222222222222'
    ORDER BY starts_at DESC LIMIT 1;
    INSERT INTO match_teams (id, organization_id, league_id, match_id, index, score, is_winner, created_at) VALUES
      ('eeeeeeee-1000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '${NEWER_MATCH_ID}', 0, 10, TRUE, now()),
      ('eeeeeeee-1000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '${NEWER_MATCH_ID}', 1, 4, FALSE, now());
    INSERT INTO match_team_players (id, organization_id, league_id, match_team_id, league_player_id, index, created_at) VALUES
      ('eeeeeeee-1000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-1000-0000-0000-000000000011', '66666666-6666-6666-6666-666666666601', 0, now()),
      ('eeeeeeee-1000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-1000-0000-0000-000000000011', '05f2a382-cd67-5017-8d13-2e331fad5e67', 1, now()),
      ('eeeeeeee-1000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-1000-0000-0000-000000000012', '069702f5-f711-585c-9c4d-74d0bf121d2e', 0, now()),
      ('eeeeeeee-1000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-1000-0000-0000-000000000012', '07578876-1766-533c-9f67-2a04847c16e5', 1, now());
  `);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await pull(client);

  // The newer match leads and every loaded row follows it, one place down.
  await expect
    .poll(async () => (await shown()).slice(1))
    .toEqual(before.slice(0, 39));
  expect(before).not.toContain((await shown())[0]);

  await page.getByRole('button', { name: 'Load older matches' }).click();
  await expect(playedAt).toHaveCount(60);
  const after = await shown();
  expect(new Set(after).size).toBe(60);
  expect(after.slice(1, 41)).toEqual(before);
});
