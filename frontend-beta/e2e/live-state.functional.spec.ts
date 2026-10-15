import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { gotoAuthed } from './helpers';

const MATCHMAKING = '/test-org/test-league/matchmaking';
const PENDING_MATCH_ID = 'eeeeeeee-3000-0000-0000-000000000001';
const TEAM_ONE_ID = 'eeeeeeee-3000-0000-0000-000000000002';
const TEAM_TWO_ID = 'eeeeeeee-3000-0000-0000-000000000003';
const ACTIVE_MATCH_ID = 'eeeeeeee-3000-0000-0000-000000000004';

function runSql(sql: string) {
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
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
}

function insertActiveMatch() {
  runSql(`
    INSERT INTO pending_matches
      (id, organization_id, league_id, status, expires_at, created_at)
    VALUES
      ('${PENDING_MATCH_ID}', '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222', 1,
       now() + interval '5 minutes', now());

    INSERT INTO pending_match_teams
      (id, organization_id, league_id, pending_match_id, index, created_at)
    VALUES
      ('${TEAM_ONE_ID}', '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222', '${PENDING_MATCH_ID}', 0, now()),
      ('${TEAM_TWO_ID}', '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222', '${PENDING_MATCH_ID}', 1, now());

    INSERT INTO pending_match_team_players
      (id, pending_match_team_id, league_player_id, index, created_at)
    SELECT
      gen_random_uuid(),
      CASE WHEN row_number <= 2 THEN '${TEAM_ONE_ID}' ELSE '${TEAM_TWO_ID}' END::uuid,
      id,
      (row_number - 1) % 2,
      now()
    FROM (
      SELECT id, row_number() OVER (ORDER BY id)
      FROM league_players
      WHERE league_id = '22222222-2222-2222-2222-222222222222'
      LIMIT 4
    ) players;

    INSERT INTO active_matches
      (id, organization_id, league_id, pending_match_id, started_at, created_at)
    VALUES
      ('${ACTIVE_MATCH_ID}', '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222', '${PENDING_MATCH_ID}',
       now(), now());
  `);
}

function removeActiveMatch() {
  runSql(`
    DELETE FROM active_matches WHERE id = '${ACTIVE_MATCH_ID}';
    DELETE FROM pending_match_team_players
      WHERE pending_match_team_id IN ('${TEAM_ONE_ID}', '${TEAM_TWO_ID}');
    DELETE FROM pending_match_teams WHERE pending_match_id = '${PENDING_MATCH_ID}';
    DELETE FROM pending_matches WHERE id = '${PENDING_MATCH_ID}';
  `);
}

test('changing leagues clears matchmaking mutation feedback', async ({
  page,
}) => {
  await gotoAuthed(page, MATCHMAKING);
  const isServerFn = (url: URL) => url.pathname.startsWith('/_serverFn/');
  await page.route(isServerFn, async (route) => {
    if (route.request().method() === 'POST') await route.abort();
    else await route.fallback();
  });

  await page.getByRole('button', { name: /Queue up/ }).click();
  await expect(page.getByRole('alert')).toHaveText('Failed to join queue');
  await page.unroute(isServerFn);

  await page
    .getByRole('button', { name: 'Switch organization or league' })
    .click();
  await page.getByRole('menuitem', { name: 'Singles League' }).click();

  await expect(page).toHaveURL(/\/test-org\/singles-league\/matchmaking$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Queue up/ })).toBeVisible();
});

test('an active match created after load appears through polling', async ({
  page,
}) => {
  await gotoAuthed(page, MATCHMAKING);
  const heading = page.getByRole('heading', { name: 'Active matches' });
  await expect(heading).toHaveCount(0);

  try {
    insertActiveMatch();

    await expect(heading).toBeVisible({ timeout: 10_000 });
    const card = heading.locator('xpath=following-sibling::div[1]');
    await expect(
      card.getByRole('link', { name: 'Submit Result' })
    ).toBeVisible();
  } finally {
    removeActiveMatch();
  }
});
