import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
const { test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

test('add visual-only empty and active-match fixtures', () => {
  mkdirSync(new URL('../test-results/visual', import.meta.url), {
    recursive: true,
  });
  copyFileSync(
    new URL('../../frontend/e2e/.auth/user.json', import.meta.url),
    new URL('../test-results/visual/auth.json', import.meta.url)
  );
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
      INSERT INTO organizations (id, name, slug, created_at)
      VALUES ('eeeeeeee-2000-0000-0000-000000000001', 'Invited Organization', 'invited-organization', '2026-01-01');
      INSERT INTO organization_memberships (id, organization_id, role, status, display_name, username, created_at)
      VALUES ('eeeeeeee-2000-0000-0000-000000000002', 'eeeeeeee-2000-0000-0000-000000000001', 0, 1, 'Invite Owner', 'invite-owner', '2026-01-01');
      INSERT INTO organization_invite_links (id, organization_id, code, created_by_membership_id, use_count, created_at)
      VALUES ('eeeeeeee-2000-0000-0000-000000000003', 'eeeeeeee-2000-0000-0000-000000000001', 'VIZUAL23456', 'eeeeeeee-2000-0000-0000-000000000002', 0, '2026-01-01');
      INSERT INTO leagues (id, organization_id, name, slug, team_size, winning_score, created_at)
      VALUES ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Empty League', 'empty-league', 2, 10, '2026-01-01');
      INSERT INTO league_players (id, organization_id, league_id, organization_membership_id, mmr, mu, sigma, created_at)
      VALUES ('eeeeeeee-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555501', 1500, 25, 8.333, '2026-01-01');
      INSERT INTO pending_matches (id, organization_id, league_id, status, expires_at, created_at)
      VALUES ('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 1, now() + interval '1 day', '2026-01-01');
      INSERT INTO pending_match_teams (id, organization_id, league_id, pending_match_id, index, created_at)
      SELECT ('eeeeeeee-0000-0000-0000-00000000000' || (3 + i))::uuid, '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-0000-0000-0000-000000000002', i, '2026-01-01' FROM generate_series(0, 1) i;
      INSERT INTO pending_match_team_players (id, pending_match_team_id, league_player_id, index, created_at)
      SELECT gen_random_uuid(), ('eeeeeeee-0000-0000-0000-00000000000' || (3 + ((row_number - 1) / 2)))::uuid, id, (row_number - 1) % 2, '2026-01-01'
      FROM (SELECT id, row_number() OVER (ORDER BY (id = '66666666-6666-6666-6666-666666666601') DESC, id) FROM league_players WHERE league_id = '22222222-2222-2222-2222-222222222222' LIMIT 4) players;
      INSERT INTO active_matches (id, organization_id, league_id, pending_match_id, started_at, created_at)
      VALUES ('eeeeeeee-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-0000-0000-0000-000000000002', '2026-01-01', '2026-01-01');
    `,
    }
  );
});
