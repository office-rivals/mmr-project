import { execFileSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';
import { isServerFn } from './server-fns';

const LEAGUE_ADMIN = '/admin/test-org/leagues/test-league';
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const LEAGUE_ID = '22222222-2222-2222-2222-222222222222';
const FLAG_ID = 'f1a90000-0000-0000-0000-0000000000d1';
const FLAG_REASON = 'Entered twice, I never played this one (e2e D).';

// Three matches on one morning, long before the seed's, so they sit next to
// each other in the league and at the end of the admin list. The flagged one
// repeats the first with one player changed.
const ORIGINAL = 'd0000000-0000-0000-0000-000000000001';
const REPORTED = 'd0000000-0000-0000-0000-000000000002';
const LATER = 'd0000000-0000-0000-0000-000000000003';
const STAGED = [ORIGINAL, REPORTED, LATER];

/** psql is the sanctioned arrange/inspect channel for e2e (see e2e/README.md). */
function psql(sql: string): string {
  return execFileSync(
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
      '-tAc',
      sql,
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: process.env.E2E_DB_PASS ?? 'this_is_a_hard_password1337',
      },
      encoding: 'utf8',
    }
  ).trim();
}

const ids = STAGED.map((id) => `'${id}'`).join(',');

function cleanUp() {
  psql(`
    DELETE FROM match_flags WHERE id = '${FLAG_ID}' OR match_id IN (${ids});
    DELETE FROM rating_histories WHERE match_id IN (${ids});
    DELETE FROM match_team_players WHERE match_team_id IN
      (SELECT id FROM match_teams WHERE match_id IN (${ids}));
    DELETE FROM match_teams WHERE match_id IN (${ids});
    DELETE FROM matches WHERE id IN (${ids});
  `);
}

function stage() {
  psql(`
    BEGIN;
    CREATE TEMP TABLE staged(id uuid, at timestamptz,
      a1 text, a2 text, sa int, b1 text, b2 text, sb int);
    INSERT INTO staged VALUES
      ('${ORIGINAL}', '2001-03-01 11:31+00', 'alia', 'amal', 10, 'bebi', 'bobr', 5),
      ('${REPORTED}', '2001-03-01 11:35+00', 'alia', 'caca', 10, 'bebi', 'bobr', 5),
      ('${LATER}',    '2001-03-01 13:20+00', 'bobr', 'amal', 10, 'alia', 'caca', 9);
    CREATE TEMP TABLE lp AS
      SELECT om.username AS u, lp.id
      FROM league_players lp
      JOIN organization_memberships om ON om.id = lp.organization_membership_id
      WHERE lp.league_id = '${LEAGUE_ID}';
    INSERT INTO matches(id, league_id, season_id, source, created_by_membership_id,
                        played_at, recorded_at, created_at, organization_id)
    SELECT id, '${LEAGUE_ID}',
      (SELECT id FROM seasons WHERE league_id = '${LEAGUE_ID}'
       ORDER BY starts_at DESC LIMIT 1),
      0, (SELECT organization_membership_id FROM league_players
          WHERE id = (SELECT id FROM lp WHERE u = 'alia')),
      at, at, at, '${ORG_ID}'
    FROM staged;
    INSERT INTO match_teams(id, league_id, match_id, index, score, is_winner,
                            created_at, organization_id)
    SELECT md5(id::text || t)::uuid, '${LEAGUE_ID}', id, t,
      CASE t WHEN 0 THEN sa ELSE sb END,
      CASE t WHEN 0 THEN sa > sb ELSE sb > sa END, at, '${ORG_ID}'
    FROM staged, generate_series(0, 1) t;
    INSERT INTO match_team_players(id, league_id, match_team_id, league_player_id,
                                   index, created_at, organization_id)
    SELECT md5(s.id::text || t || i)::uuid, '${LEAGUE_ID}',
      md5(s.id::text || t)::uuid, lp.id, i, s.at, '${ORG_ID}'
    FROM staged s, generate_series(0, 1) t, generate_series(0, 1) i, lp
    WHERE lp.u = CASE WHEN t = 0 AND i = 0 THEN a1 WHEN t = 0 THEN a2
                      WHEN i = 0 THEN b1 ELSE b2 END;
    INSERT INTO match_flags(id, league_id, match_id, flagged_by_membership_id,
                            reason, status, created_at, updated_at, organization_id)
    SELECT '${FLAG_ID}', '${LEAGUE_ID}', '${REPORTED}',
      organization_membership_id, '${FLAG_REASON}', 0, now(), now(), '${ORG_ID}'
    FROM league_players WHERE id = (SELECT id FROM lp WHERE u = 'bobr');
    COMMIT;
  `);
  const players = psql(`
    SELECT count(*) FROM match_team_players mtp
    JOIN match_teams mt ON mt.id = mtp.match_team_id
    WHERE mt.match_id IN (${ids})`);
  // A missing username would silently stage a short team.
  expect(players).toBe('12');
}

const matchExists = (id: string) =>
  psql(`SELECT count(*) FROM matches WHERE id = '${id}'`) === '1';

const reportCard = (page: Page) =>
  page.getByTestId('match-flag-card').filter({ hasText: FLAG_REASON });

test.describe.serial('Admin match review', () => {
  test.beforeAll(() => {
    cleanUp();
    stage();
  });
  test.afterAll(cleanUp);

  test('a report shows the matches just before and after, with the duplicate marked', async ({
    page,
  }) => {
    await page.goto(`${LEAGUE_ADMIN}/match-flags`);
    const card = reportCard(page);

    const before = card.getByTestId('match-neighbour-before');
    await expect(before).toContainText('Just before · 4 min earlier');
    await expect(before).toContainText('Likely duplicate');
    await expect(before).toContainText('Same score, 3 of 4 players the same');
    await expect(before).toHaveAttribute('data-likely-duplicate', '');
    await expect(before).toContainText('amal');

    await expect(card.getByTestId('match-flag-reported')).toContainText('caca');

    const after = card.getByTestId('match-neighbour-after');
    await expect(after).toContainText('Just after · 1 h 45 min later');
    await expect(after).not.toContainText('Likely duplicate');
    await expect(after).not.toHaveAttribute('data-likely-duplicate');
  });

  test('deleting from the report asks for the score and removes the report', async ({
    page,
  }) => {
    await page.goto(`${LEAGUE_ADMIN}/match-flags`);
    const dialog = page.getByTestId('delete-match-dialog');
    await expect(async () => {
      await reportCard(page).getByTestId('match-flag-delete').click();
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await expect(dialog.getByTestId('delete-match-score')).toHaveText('10-5');
    await expect(dialog).toContainText('Recalculate season');
    const input = dialog.getByTestId('delete-match-confirmation');
    const submit = dialog.getByTestId('delete-match-submit');
    await expect(submit).toBeDisabled();

    await input.pressSequentially('5-10');
    await expect(submit).toBeDisabled();
    // Enter must not get round the disabled button: no delete is even sent.
    const deletes = { count: 0 };
    page.on('request', (req) => {
      if (req.method() === 'POST' && isServerFn(req.url(), 'deleteMatchFn'))
        deletes.count += 1;
    });
    await input.press('Enter');
    await page.waitForTimeout(500);
    expect(deletes.count).toBe(0);
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    expect(matchExists(REPORTED)).toBe(true);

    await input.fill('');
    await input.pressSequentially('10 - 5');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Run Recalculate season' })
    ).toBeVisible();
    await expect(reportCard(page)).toHaveCount(0);
    expect(matchExists(REPORTED)).toBe(false);
    expect(
      psql(`SELECT count(*) FROM match_flags WHERE id = '${FLAG_ID}'`)
    ).toBe('0');
  });

  test('a delete posted without the right score is refused', async ({
    page,
  }) => {
    await page.goto(`${LEAGUE_ADMIN}/matches`);
    const origin = new URL(page.url()).origin;
    const post = (confirmation: string) =>
      page.request.post(`${LEAGUE_ADMIN}/matches`, {
        headers: { origin },
        form: { _action: 'delete', matchId: ORIGINAL, confirmation },
        maxRedirects: 0,
      });

    for (const wrong of ['', '5-10', 'delete']) {
      expect((await post(wrong)).status()).toBe(400);
    }
    expect(matchExists(ORIGINAL)).toBe(true);
  });

  test('Delete on the matches list asks for the score too', async ({
    page,
  }) => {
    // The staged matches are the oldest, so the later one opens the last page.
    const total = Number(
      psql(`SELECT count(*) FROM matches WHERE league_id = '${LEAGUE_ID}'`)
    );
    await page.goto(`${LEAGUE_ADMIN}/matches?offset=${total - 2}`);
    const row = page.locator(`[data-match-id="${LATER}"]`);
    await expect(row).toBeVisible();

    const dialog = page.getByTestId('delete-match-dialog');
    await expect(async () => {
      await row.getByTestId('admin-match-delete').click();
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await expect(dialog.getByTestId('delete-match-score')).toHaveText('10-9');
    const input = dialog.getByTestId('delete-match-confirmation');
    const submit = dialog.getByTestId('delete-match-submit');
    await expect(submit).toBeDisabled();

    // Another admin corrects the score while this dialog is open.
    psql(`UPDATE match_teams SET score = 8
          WHERE match_id = '${LATER}' AND index = 1`);
    await input.pressSequentially('10-9');
    await submit.click();
    await expect(dialog.getByRole('alert')).toContainText(
      'Type the score 10-8'
    );
    expect(matchExists(LATER)).toBe(true);

    // The dialog now asks for the score the server checks.
    await expect(dialog.getByTestId('delete-match-score')).toHaveText('10-8');
    await expect(submit).toBeDisabled();
    await input.fill('');
    await input.pressSequentially('10-8');
    await submit.click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(row).toHaveCount(0);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Match deleted' })
    ).toBeVisible();
    expect(matchExists(LATER)).toBe(false);
  });
});
