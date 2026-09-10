import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import { execFileSync } from 'node:child_process';

const { test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

test('add a current-user flag for edit-dialog scenes', () => {
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
        DELETE FROM match_flags
        WHERE id = 'eeeeeeee-4000-0000-0000-000000000001';

        INSERT INTO match_flags
          (id, organization_id, league_id, match_id,
           flagged_by_membership_id, reason, status, created_at, updated_at)
        SELECT
          'eeeeeeee-4000-0000-0000-000000000001',
          m.organization_id,
          m.league_id,
          m.id,
          '55555555-5555-5555-5555-555555555501',
          'Current-user visual parity flag.',
          0,
          '2026-09-10T12:00:00+00:00',
          '2026-09-10T12:00:00+00:00'
        FROM matches m
        WHERE m.league_id = '22222222-2222-2222-2222-222222222222'
          AND m.season_id = 'c97930bd-5493-5299-bd90-a3d6fb16c61e'
          AND EXISTS (
            SELECT 1
            FROM match_teams mt
            JOIN match_team_players mtp ON mtp.match_team_id = mt.id
            WHERE mt.match_id = m.id
              AND mtp.league_player_id = '66666666-6666-6666-6666-666666666601'
          )
        ORDER BY m.played_at DESC, m.recorded_at DESC, m.created_at DESC
        LIMIT 1;
      `,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
});
