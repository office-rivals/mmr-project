import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import { execFileSync } from 'node:child_process';

const { test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

test('add a visual-only pending match fixture', () => {
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
        INSERT INTO leagues (id, organization_id, name, slug, team_size, winning_score, created_at)
        VALUES ('eeeeeeee-3000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Pending League', 'pending-league', 2, 10, '2026-01-01');
        INSERT INTO seasons (id, organization_id, league_id, starts_at, created_at)
        VALUES ('eeeeeeee-3000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-3000-0000-0000-000000000001', '2026-01-01', '2026-01-01');
        INSERT INTO league_players (id, organization_id, league_id, organization_membership_id, mmr, mu, sigma, created_at) VALUES
          ('eeeeeeee-3000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-3000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555501', 1500, 25, 8.333, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-3000-0000-0000-000000000001', '89df9aac-861b-56ae-9a7e-fa8f7d372ded', 1500, 25, 8.333, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-3000-0000-0000-000000000001', 'bbb2cc39-4662-5456-816c-e94352eb9e26', 1500, 25, 8.333, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-3000-0000-0000-000000000001', '08b2f203-d868-56ba-bd20-376b67d31704', 1500, 25, 8.333, '2026-01-01');
        INSERT INTO pending_matches (id, organization_id, league_id, status, expires_at, created_at)
        VALUES ('eeeeeeee-3000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-3000-0000-0000-000000000001', 0, now() + interval '7 days', '2026-01-01');
        INSERT INTO pending_match_teams (id, organization_id, league_id, pending_match_id, index, created_at) VALUES
          ('eeeeeeee-3000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000020', 0, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000020', 1, '2026-01-01');
        INSERT INTO pending_match_team_players (id, pending_match_team_id, league_player_id, index, created_at) VALUES
          ('eeeeeeee-3000-0000-0000-000000000031', 'eeeeeeee-3000-0000-0000-000000000021', 'eeeeeeee-3000-0000-0000-000000000011', 0, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000032', 'eeeeeeee-3000-0000-0000-000000000021', 'eeeeeeee-3000-0000-0000-000000000012', 1, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000033', 'eeeeeeee-3000-0000-0000-000000000022', 'eeeeeeee-3000-0000-0000-000000000013', 0, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000034', 'eeeeeeee-3000-0000-0000-000000000022', 'eeeeeeee-3000-0000-0000-000000000014', 1, '2026-01-01');
        INSERT INTO pending_match_acceptances (id, pending_match_id, league_player_id, status, accepted_at, created_at) VALUES
          ('eeeeeeee-3000-0000-0000-000000000041', 'eeeeeeee-3000-0000-0000-000000000020', 'eeeeeeee-3000-0000-0000-000000000011', 0, NULL, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000042', 'eeeeeeee-3000-0000-0000-000000000020', 'eeeeeeee-3000-0000-0000-000000000012', 1, '2026-01-01', '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000043', 'eeeeeeee-3000-0000-0000-000000000020', 'eeeeeeee-3000-0000-0000-000000000013', 0, NULL, '2026-01-01'),
          ('eeeeeeee-3000-0000-0000-000000000044', 'eeeeeeee-3000-0000-0000-000000000020', 'eeeeeeee-3000-0000-0000-000000000014', 1, '2026-01-01', '2026-01-01');
      `,
    }
  );
});
