-- =============================================================================
-- Vendored test/dev seed for the MMR project.
--
-- Wipes all v3 data and inserts a deterministic fixture with:
--   - 2 organizations ("Test Org" / test-org, "Other Org" / other-org)
--     - Test Org: test user is Owner. Used for the bulk of e2e coverage.
--     - Other Org: test user is Member only. Used for RBAC tests that assert
--       the admin tree is closed to non-admins.
--   - 2 leagues (one per org; "Test League" + "Other League", both 2v2)
--   - 3 seasons in Test League (past, mid, current — current is the default)
--   - 6 league players, including 1 test user account (E2E login target)
--   - 15 matches in the current season (enough for ranked thresholds and streaks)
--   - 3 matches in the past season
--   - rating_histories with positive/negative deltas so sparklines + MMR render
--
-- Variables (passed via `psql -v`):
--   identity_user_id   Clerk identity_user_id of the test user
--   user_email         Email for the test user
--
-- Usage:
--   psql ... -v identity_user_id=user_xxx -v user_email=me@example.com -f seed-data.sql
--   or use scripts/seed-local.sh which wraps this with sane defaults.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Wipe v3 data only (preserve __EFMigrationsHistory and legacy_* tables).
TRUNCATE
    rating_histories,
    match_team_players,
    match_teams,
    matches,
    pending_match_acceptances,
    pending_match_team_players,
    pending_match_teams,
    pending_matches,
    active_matches,
    queue_entries,
    match_flags,
    league_players,
    seasons,
    organization_invite_links,
    personal_access_tokens,
    organization_memberships,
    leagues,
    organizations,
    users
CASCADE;

INSERT INTO organizations (id, name, slug, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Org', 'test-org', now() - interval '1 year');

INSERT INTO leagues (id, organization_id, name, slug, queue_size, created_at) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'Test League', 'test-league', 4, now() - interval '1 year');

INSERT INTO seasons (id, organization_id, league_id, starts_at, created_at) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', now() - interval '6 months', now() - interval '6 months'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', now() - interval '3 months', now() - interval '3 months'),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', now() - interval '1 day', now() - interval '1 day');

INSERT INTO users (id, identity_user_id, email, username, display_name, created_at) VALUES
  ('44444444-4444-4444-4444-444444444401', :'identity_user_id', :'user_email',
   'tuser', 'Test User', now() - interval '6 months');

-- Test user (Owner) + 5 unclaimed members
INSERT INTO organization_memberships
  (id, organization_id, user_id, role, status, claimed_at, created_at, display_name, username) VALUES
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111111',
   '44444444-4444-4444-4444-444444444401', 0, 1, now(), now() - interval '6 months', 'Test User', 'tuser');
INSERT INTO organization_memberships
  (id, organization_id, role, status, created_at, display_name, username) VALUES
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111111', 2, 1, now() - interval '6 months', 'Alice Anderson', 'alia'),
  ('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111111', 2, 1, now() - interval '6 months', 'Bob Brown',      'bobr'),
  ('55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111111', 2, 1, now() - interval '6 months', 'Carol Carter',   'caca'),
  ('55555555-5555-5555-5555-555555555505', '11111111-1111-1111-1111-111111111111', 2, 1, now() - interval '6 months', 'Dave Davies',    'dada'),
  ('55555555-5555-5555-5555-555555555506', '11111111-1111-1111-1111-111111111111', 2, 1, now() - interval '6 months', 'Eve Edwards',    'eved');

-- =============================================================================
-- Second org where the test user is a Member (not Owner/Moderator). Used by
-- the RBAC e2e tests to verify admin pages 403 for non-admins.
-- =============================================================================
INSERT INTO organizations (id, name, slug, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Other Org', 'other-org', now() - interval '1 year');

INSERT INTO leagues (id, organization_id, name, slug, queue_size, created_at) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Other League', 'other-league', 4, now() - interval '1 year');

-- Membership status 1 = Active, role 2 = Member (see OrganizationRole.cs).
INSERT INTO organization_memberships
  (id, organization_id, user_id, role, status, claimed_at, created_at, display_name, username) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444401', 2, 1, now(), now() - interval '6 months', 'Test User', 'tuser');

INSERT INTO league_players
  (id, organization_id, league_id, organization_membership_id, mmr, mu, sigma, created_at) VALUES
  ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555501', 1500, 25, 8.333, now() - interval '6 months'),
  ('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555502', 1500, 25, 8.333, now() - interval '6 months'),
  ('66666666-6666-6666-6666-666666666603', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555503', 1500, 25, 8.333, now() - interval '6 months'),
  ('66666666-6666-6666-6666-666666666604', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555504', 1500, 25, 8.333, now() - interval '6 months'),
  ('66666666-6666-6666-6666-666666666605', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555505', 1500, 25, 8.333, now() - interval '6 months'),
  ('66666666-6666-6666-6666-666666666606', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555506', 1500, 25, 8.333, now() - interval '6 months');

-- Helper to insert a match with both teams + players + rating histories.
CREATE OR REPLACE FUNCTION pg_temp.create_match(
    p_match_id uuid,
    p_season_id uuid,
    p_played_at timestamptz,
    p_team1_p1 uuid, p_team1_p2 uuid,
    p_team2_p1 uuid, p_team2_p2 uuid,
    p_team1_score int, p_team2_score int,
    p_team1_p1_mmr bigint, p_team1_p1_delta bigint,
    p_team1_p2_mmr bigint, p_team1_p2_delta bigint,
    p_team2_p1_mmr bigint, p_team2_p1_delta bigint,
    p_team2_p2_mmr bigint, p_team2_p2_delta bigint
) RETURNS void AS $$
DECLARE
    v_team1_id uuid := gen_random_uuid();
    v_team2_id uuid := gen_random_uuid();
    v_org uuid := '11111111-1111-1111-1111-111111111111';
    v_league uuid := '22222222-2222-2222-2222-222222222222';
    v_creator uuid := '55555555-5555-5555-5555-555555555501';
BEGIN
    INSERT INTO matches (id, organization_id, league_id, season_id, source,
                         created_by_membership_id, played_at, recorded_at, created_at)
    VALUES (p_match_id, v_org, v_league, p_season_id, 0, v_creator, p_played_at, p_played_at, p_played_at);

    INSERT INTO match_teams (id, organization_id, league_id, match_id, index, score, is_winner, created_at)
    VALUES
      (v_team1_id, v_org, v_league, p_match_id, 0, p_team1_score, p_team1_score > p_team2_score, p_played_at),
      (v_team2_id, v_org, v_league, p_match_id, 1, p_team2_score, p_team2_score > p_team1_score, p_played_at);

    INSERT INTO match_team_players
        (id, organization_id, league_id, match_team_id, league_player_id, index, created_at)
    VALUES
      (gen_random_uuid(), v_org, v_league, v_team1_id, p_team1_p1, 0, p_played_at),
      (gen_random_uuid(), v_org, v_league, v_team1_id, p_team1_p2, 1, p_played_at),
      (gen_random_uuid(), v_org, v_league, v_team2_id, p_team2_p1, 0, p_played_at),
      (gen_random_uuid(), v_org, v_league, v_team2_id, p_team2_p2, 1, p_played_at);

    INSERT INTO rating_histories
        (id, organization_id, league_player_id, match_id, mmr, mu, sigma, delta, created_at)
    VALUES
      (gen_random_uuid(), v_org, p_team1_p1, p_match_id, p_team1_p1_mmr, 25, 8.333, p_team1_p1_delta, p_played_at),
      (gen_random_uuid(), v_org, p_team1_p2, p_match_id, p_team1_p2_mmr, 25, 8.333, p_team1_p2_delta, p_played_at),
      (gen_random_uuid(), v_org, p_team2_p1, p_match_id, p_team2_p1_mmr, 25, 8.333, p_team2_p1_delta, p_played_at),
      (gen_random_uuid(), v_org, p_team2_p2, p_match_id, p_team2_p2_mmr, 25, 8.333, p_team2_p2_delta, p_played_at);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Players (P1=test user .601, P2=.602, P3=.603, P4=.604, P5=.605, P6=.606)
--
-- Past season (mid): 3 matches.
-- ============================================================================
SELECT pg_temp.create_match(
    '77777777-7777-7777-7777-777777777701'::uuid, '33333333-3333-3333-3333-333333333302'::uuid,
    now() - interval '90 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666602',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666604',
    10, 5, 1500, 30, 1500, 25, 1500, -28, 1500, -27
);
SELECT pg_temp.create_match(
    '77777777-7777-7777-7777-777777777702'::uuid, '33333333-3333-3333-3333-333333333302'::uuid,
    now() - interval '85 days',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666604',
    '66666666-6666-6666-6666-666666666605', '66666666-6666-6666-6666-666666666606',
    10, 7, 1472, 22, 1473, 20, 1500, -22, 1500, -23
);
SELECT pg_temp.create_match(
    '77777777-7777-7777-7777-777777777703'::uuid, '33333333-3333-3333-3333-333333333302'::uuid,
    now() - interval '80 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666603',
    '66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666604',
    10, 8, 1530, 18, 1494, 25, 1525, -19, 1493, -22
);

-- ============================================================================
-- Current season: 15 matches.
--   - P1 plays in 11. Wins 8, loses 3. (current win streak via last 3+ wins)
--   - P3 plays in 13. Loses many → losing-streak indicator.
-- ============================================================================
SELECT pg_temp.create_match( -- M1: P1+P3 win
    '88888888-8888-8888-8888-888888888801'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '20 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666603',
    '66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666604',
    10, 6, 1548, 18, 1512, 18, 1487, -19, 1471, -22
);
SELECT pg_temp.create_match( -- M2: P1+P2 win
    '88888888-8888-8888-8888-888888888802'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '19 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666602',
    '66666666-6666-6666-6666-666666666604', '66666666-6666-6666-6666-666666666605',
    10, 8, 1566, 18, 1489, 17, 1456, -15, 1471, -22
);
SELECT pg_temp.create_match( -- M3: P1+P4 lose
    '88888888-8888-8888-8888-888888888803'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '18 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666604',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666605',
    5, 10, 1546, -20, 1432, -24, 1530, 18, 1490, 19
);
SELECT pg_temp.create_match( -- M4: P2+P3 win (no P1)
    '88888888-8888-8888-8888-888888888804'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '17 days',
    '66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666603',
    '66666666-6666-6666-6666-666666666605', '66666666-6666-6666-6666-666666666606',
    10, 4, 1506, 17, 1547, 17, 1471, -19, 1351, -25
);
SELECT pg_temp.create_match( -- M5: P1+P2 win
    '88888888-8888-8888-8888-888888888805'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '16 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666602',
    '66666666-6666-6666-6666-666666666604', '66666666-6666-6666-6666-666666666606',
    10, 7, 1564, 18, 1523, 17, 1408, -18, 1326, -25
);
SELECT pg_temp.create_match( -- M6: P1+P3 win
    '88888888-8888-8888-8888-888888888806'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '15 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666603',
    '66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666605',
    10, 9, 1582, 18, 1564, 17, 1540, -23, 1466, -24
);
SELECT pg_temp.create_match( -- M7: P1+P4 win
    '88888888-8888-8888-8888-888888888807'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '14 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666604',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666606',
    10, 5, 1600, 18, 1390, 18, 1581, -23, 1301, -25
);
SELECT pg_temp.create_match( -- M8: P2+P5 lose to P3+P6
    '88888888-8888-8888-8888-888888888808'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '13 days',
    '66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666605',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666606',
    8, 10, 1541, -23, 1442, -24, 1604, 23, 1326, 25
);
SELECT pg_temp.create_match( -- M9: P1+P2 lose
    '88888888-8888-8888-8888-888888888809'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '12 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666602',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666604',
    7, 10, 1582, -18, 1518, -23, 1627, 23, 1390, 25
);
SELECT pg_temp.create_match( -- M10: P1+P3 win
    '88888888-8888-8888-8888-888888888810'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '10 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666603',
    '66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666604',
    10, 6, 1564, 17, 1645, 17, 1495, -23, 1415, -25
);
SELECT pg_temp.create_match( -- M11: P1+P2 win
    '88888888-8888-8888-8888-888888888811'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '9 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666602',
    '66666666-6666-6666-6666-666666666605', '66666666-6666-6666-6666-666666666606',
    10, 4, 1581, 17, 1512, 17, 1442, -19, 1301, -25
);
SELECT pg_temp.create_match( -- M12: P1+P3 win — keeps P1 streak going
    '88888888-8888-8888-8888-888888888812'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '7 days',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666603',
    '66666666-6666-6666-6666-666666666604', '66666666-6666-6666-6666-666666666606',
    10, 9, 1598, 17, 1662, 17, 1392, -23, 1276, -25
);
SELECT pg_temp.create_match( -- M13: P3+P4 vs P5+P6 (no P1)
    '88888888-8888-8888-8888-888888888813'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '5 days',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666604',
    '66666666-6666-6666-6666-666666666605', '66666666-6666-6666-6666-666666666606',
    10, 6, 1679, 17, 1369, 23, 1423, -19, 1251, -25
);
SELECT pg_temp.create_match( -- M14: P5+P6 win
    '88888888-8888-8888-8888-888888888814'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '3 days',
    '66666666-6666-6666-6666-666666666605', '66666666-6666-6666-6666-666666666606',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666604',
    10, 7, 1442, 19, 1226, 25, 1696, -17, 1392, -22
);
SELECT pg_temp.create_match( -- M15: P1+P2 win — most recent
    '88888888-8888-8888-8888-888888888815'::uuid, '33333333-3333-3333-3333-333333333303'::uuid,
    now() - interval '1 day',
    '66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666602',
    '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666605',
    10, 8, 1615, 17, 1679, 17, 1674, -22, 1424, -18
);

-- Sync each league_player.mmr to their latest rating_history.mmr
UPDATE league_players lp
SET mmr = latest.mmr
FROM (
    SELECT DISTINCT ON (rh.league_player_id)
        rh.league_player_id, rh.mmr
    FROM rating_histories rh
    JOIN matches m ON m.id = rh.match_id
    ORDER BY rh.league_player_id, m.played_at DESC, m.recorded_at DESC, m.created_at DESC
) latest
WHERE lp.id = latest.league_player_id;

COMMIT;

DO $$
DECLARE
    v_users int; v_memberships int; v_league_players int; v_seasons int; v_matches int;
BEGIN
    SELECT count(*) INTO v_users FROM users;
    SELECT count(*) INTO v_memberships FROM organization_memberships;
    SELECT count(*) INTO v_league_players FROM league_players;
    SELECT count(*) INTO v_seasons FROM seasons;
    SELECT count(*) INTO v_matches FROM matches;
    RAISE NOTICE '';
    RAISE NOTICE '=== Seed summary ===';
    RAISE NOTICE 'Users:            %', v_users;
    RAISE NOTICE 'Memberships:      %', v_memberships;
    RAISE NOTICE 'League players:   %', v_league_players;
    RAISE NOTICE 'Seasons:          %', v_seasons;
    RAISE NOTICE 'Matches:          %', v_matches;
    RAISE NOTICE '====================';
END $$;
