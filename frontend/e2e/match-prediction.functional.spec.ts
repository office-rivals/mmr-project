import playwright, {
  type Page,
} from '../../frontend/node_modules/@playwright/test/index.js';
import { execFileSync } from 'node:child_process';
import { gotoAuthed } from './helpers';
import type { MatchPredictionResponse, QueueStatusResponse } from '@/api-v3';
const { expect, test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const LEAGUE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_USER_PLAYER_ID = '66666666-6666-6666-6666-666666666601';
const LEAGUE = '/test-org/test-league';
const MATCHMAKING = `${LEAGUE}/matchmaking`;
const QUEUE_API = `/api/v3/organizations/${ORG_ID}/leagues/${LEAGUE_ID}/queue`;

const PENDING_MATCH_ID = 'eeeeeeee-4000-0000-0000-000000000001';
const TEAM_ONE_ID = 'eeeeeeee-4000-0000-0000-000000000002';
const TEAM_TWO_ID = 'eeeeeeee-4000-0000-0000-000000000003';
const ACTIVE_MATCH_ID = 'eeeeeeee-4000-0000-0000-000000000004';

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

/**
 * A 2v2 with the test user and three other league players. `active` stages it
 * as started; otherwise it waits on everyone to accept.
 */
function stageMatch({ active }: { active: boolean }) {
  runSql(`
    INSERT INTO pending_matches
      (id, organization_id, league_id, status, expires_at, created_at)
    VALUES
      ('${PENDING_MATCH_ID}', '${ORG_ID}', '${LEAGUE_ID}', ${active ? 1 : 0},
       now() + interval '5 minutes', now());

    INSERT INTO pending_match_teams
      (id, organization_id, league_id, pending_match_id, index, created_at)
    VALUES
      ('${TEAM_ONE_ID}', '${ORG_ID}', '${LEAGUE_ID}', '${PENDING_MATCH_ID}', 0, now()),
      ('${TEAM_TWO_ID}', '${ORG_ID}', '${LEAGUE_ID}', '${PENDING_MATCH_ID}', 1, now());

    INSERT INTO pending_match_team_players
      (id, pending_match_team_id, league_player_id, index, created_at)
    SELECT
      gen_random_uuid(),
      CASE WHEN slot <= 2 THEN '${TEAM_ONE_ID}' ELSE '${TEAM_TWO_ID}' END::uuid,
      id,
      (slot - 1) % 2,
      now()
    FROM (
      SELECT id, row_number() OVER (ORDER BY id <> '${TEST_USER_PLAYER_ID}', id) AS slot
      FROM league_players
      WHERE league_id = '${LEAGUE_ID}'
      ORDER BY id <> '${TEST_USER_PLAYER_ID}', id
      LIMIT 4
    ) players;

    INSERT INTO pending_match_acceptances
      (id, pending_match_id, league_player_id, status, accepted_at, created_at)
    SELECT gen_random_uuid(), '${PENDING_MATCH_ID}', p.league_player_id,
      ${active ? 1 : 0}, ${active ? 'now()' : 'NULL'}, now()
    FROM pending_match_team_players p
    WHERE p.pending_match_team_id IN ('${TEAM_ONE_ID}', '${TEAM_TWO_ID}');

    ${
      active
        ? `INSERT INTO active_matches
             (id, organization_id, league_id, pending_match_id, started_at, created_at)
           VALUES
             ('${ACTIVE_MATCH_ID}', '${ORG_ID}', '${LEAGUE_ID}', '${PENDING_MATCH_ID}',
              now() - interval '12 minutes', now());`
        : ''
    }
  `);
}

function removeMatch() {
  runSql(`
    DELETE FROM active_matches WHERE id = '${ACTIVE_MATCH_ID}';
    DELETE FROM pending_match_acceptances WHERE pending_match_id = '${PENDING_MATCH_ID}';
    DELETE FROM pending_match_team_players
      WHERE pending_match_team_id IN ('${TEAM_ONE_ID}', '${TEAM_TWO_ID}');
    DELETE FROM pending_match_teams WHERE pending_match_id = '${PENDING_MATCH_ID}';
    DELETE FROM pending_matches WHERE id = '${PENDING_MATCH_ID}';
  `);
}

/** What the page should read, worked out from the API's own prediction. */
function expectedOdds(prediction: MatchPredictionResponse) {
  const mine = prediction.teams.find((t) =>
    t.players.some((p) => p.leaguePlayerId === TEST_USER_PLAYER_ID)
  )!;
  const me = mine.players.find(
    (p) => p.leaguePlayerId === TEST_USER_PLAYER_ID
  )!;
  const first = Math.round(
    [...prediction.teams].sort((a, b) => a.index - b.index)[0].winChance * 100
  );
  const ours = mine.index === 0 ? first : 100 - first;
  const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
  const average = (index: number) => {
    const team = prediction.teams.find((t) => t.index === index)!;
    const mean =
      team.players.reduce((sum, p) => sum + p.mmr, 0) / team.players.length;
    return `Avg ${Math.round(mean).toLocaleString('en-US')}`;
  };
  return {
    byIndex: `${first}% · ${100 - first}%`,
    ours: `${ours}% win chance`,
    theirs: `${100 - ours}%`,
    stake: `Win ${signed(me.mmrIfWin - me.mmr)} · Lose ${signed(me.mmrIfLose - me.mmr)}`,
    averages: [average(0), average(1)],
  };
}

async function queuePrediction(page: Page) {
  const response = await page.request.get(QUEUE_API);
  expect(response.ok()).toBe(true);
  const status = (await response.json()) as QueueStatusResponse;
  const match = status.pendingMatch ?? status.activeMatch;
  expect(match?.prediction, 'the API predicts the staged match').toBeTruthy();
  return match!.prediction!;
}

test.afterEach(() => removeMatch());

test('a found match shows both teams’ odds, their average MMR and your stake', async ({
  page,
}) => {
  stageMatch({ active: false });
  await gotoAuthed(page, MATCHMAKING);
  const expected = expectedOdds(await queuePrediction(page));

  const dialog = page.getByRole('dialog', { name: 'Match found!' });
  await expect(dialog).toBeVisible();
  const odds = dialog.getByTestId('win-chance');
  await expect(odds).toContainText(expected.ours);
  await expect(odds).toContainText(expected.theirs);
  await expect(odds).toContainText(expected.stake);
  for (const average of expected.averages) {
    await expect(dialog.getByText(average)).toBeVisible();
  }
});

test('a live match shows its odds on the match, on home, in the live bar and on matchmaking', async ({
  page,
}) => {
  stageMatch({ active: true });
  await gotoAuthed(page, `${LEAGUE}/active-match/${ACTIVE_MATCH_ID}`);
  const expected = expectedOdds(await queuePrediction(page));

  const odds = page.getByTestId('win-chance');
  await expect(odds).toContainText(expected.ours);
  await expect(odds).toContainText(expected.stake);
  await expect(odds).toContainText(expected.theirs);
  for (const average of expected.averages) {
    await expect(page.getByText(average)).toBeVisible();
  }

  await gotoAuthed(page, LEAGUE);
  await expect(page.getByRole('link', { name: /Live now/ })).toContainText(
    expected.byIndex
  );
  const bar = page.getByRole('region', { name: 'Live match' });
  const live = bar.getByTestId('live-win-chance');
  await expect(live).toContainText(expected.ours);
  await expect(live).toContainText(expected.stake);

  await gotoAuthed(page, MATCHMAKING);
  const card = page
    .getByRole('heading', { name: 'Active matches' })
    .locator('xpath=following-sibling::div[1]');
  const cardOdds = card.getByTestId('win-chance');
  await expect(cardOdds).toContainText(expected.ours);
  await expect(cardOdds).toContainText(expected.stake);
});

test('a live match without a prediction still shows in the live bar', async ({
  page,
}) => {
  stageMatch({ active: true });
  await page.route(`**${QUEUE_API}`, async (route) => {
    const response = await route.fetch();
    const status = (await response.json()) as QueueStatusResponse;
    if (status.activeMatch) status.activeMatch.prediction = null;
    await route.fulfill({ response, json: status });
  });

  await gotoAuthed(page, LEAGUE);

  const bar = page.getByRole('region', { name: 'Live match' });
  await expect(bar.getByRole('link', { name: 'Report result' })).toBeVisible();
  await expect(bar.getByTestId('live-win-chance')).toHaveCount(0);
  await expect(bar).not.toContainText('win chance');
});
