-- =============================================================================
-- Backfill legacy data into v3 multi-tenant tables
-- Following Issue #206, Phase 4
--
-- This script is idempotent — safe to rerun. It uses legacy_*_id columns
-- and NOT EXISTS checks to skip already-migrated rows.
--
-- Prerequisites:
--   - The RenameTablesRemoveV3Prefix migration has been applied
--   - Legacy tables are prefixed with legacy_*
--   - V3 tables have no prefix
--
-- Usage:
--   psql -h <host> -U <user> -d <db> -f scripts/backfill-legacy-data.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- Step 1: Create default Organization
-- =============================================================================
INSERT INTO organizations (id, created_at, name, slug)
SELECT gen_random_uuid(), now(), 'Default', 'default'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'default');

-- =============================================================================
-- Step 2: Create default League
-- =============================================================================
INSERT INTO leagues (id, created_at, organization_id, name, slug, queue_size)
SELECT gen_random_uuid(), now(),
       (SELECT id FROM organizations WHERE slug = 'default'),
       'Default', 'default', 4
WHERE NOT EXISTS (
    SELECT 1 FROM leagues l
    JOIN organizations o ON o.id = l.organization_id
    WHERE o.slug = 'default' AND l.slug = 'default'
);

-- =============================================================================
-- Step 3: Create User rows for legacy players with an identity
-- =============================================================================
INSERT INTO users (id, created_at, identity_user_id, email, username, display_name, legacy_player_id)
SELECT gen_random_uuid(),
       COALESCE(p.created_at, now()),
       p.identity_user_id,
       COALESCE(p.email, p.identity_user_id), -- fallback to identity_user_id if no email
       p.name,
       p.display_name,
       p.id
FROM legacy_players p
WHERE p.identity_user_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.legacy_player_id = p.id);

-- =============================================================================
-- Step 4: Create OrganizationMembership for each legacy player
--
-- Role mapping (legacy PlayerRole → v3 OrganizationRole):
--   Legacy User (0)      → V3 Member (2)
--   Legacy Moderator (1) → V3 Moderator (1)
--   Legacy Owner (2)     → V3 Owner (0)
--
-- Status: Active (1) if player has identity, Invited (0) if unclaimed
-- =============================================================================
INSERT INTO organization_memberships (
    id, created_at, organization_id, user_id, invite_email,
    display_name, username, role, status,
    role_assigned_at, claimed_at
)
SELECT gen_random_uuid(),
       COALESCE(p.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       u.id,                              -- NULL for unclaimed players
       p.email,                           -- preserve for claim flows
       p.display_name,
       p.name,
       CASE p."Role"
           WHEN 2 THEN 0                  -- Owner → Owner
           WHEN 1 THEN 1                  -- Moderator → Moderator
           ELSE 2                         -- User → Member
       END,
       CASE WHEN p.identity_user_id IS NOT NULL THEN 1 ELSE 0 END, -- Active / Invited
       p."RoleAssignedAt",
       p.migrated_at                      -- ClaimedAt from legacy MigratedAt
FROM legacy_players p
LEFT JOIN users u ON u.legacy_player_id = p.id
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN league_players lp ON lp.organization_membership_id = om.id
      WHERE lp.legacy_player_id = p.id
  );

-- =============================================================================
-- Step 4b: Backfill RoleAssignedByMembershipId
--
-- Done as a separate step because we need all memberships to exist first
-- to resolve the self-referencing FK.
-- =============================================================================
UPDATE organization_memberships om_target
SET role_assigned_by_membership_id = om_assigner.id
FROM legacy_players p
JOIN league_players lp ON lp.legacy_player_id = p.id
JOIN organization_memberships om_assigner ON om_assigner.id IN (
    SELECT om2.id FROM organization_memberships om2
    JOIN league_players lp2 ON lp2.organization_membership_id = om2.id
    WHERE lp2.legacy_player_id = p."RoleAssignedById"
)
WHERE lp.organization_membership_id = om_target.id
  AND p."RoleAssignedById" IS NOT NULL
  AND om_target.role_assigned_by_membership_id IS NULL;

-- =============================================================================
-- Step 5: Create LeaguePlayer for each legacy player in the default league
-- =============================================================================
INSERT INTO league_players (
    id, created_at, organization_id, league_id,
    organization_membership_id, mmr, mu, sigma, legacy_player_id
)
SELECT gen_random_uuid(),
       COALESCE(p.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       om.id,
       COALESCE(p.mmr, 1500),
       COALESCE(p.mu, 25.0),
       COALESCE(p.sigma, 8.333),
       p.id
FROM legacy_players p
JOIN organization_memberships om ON om.organization_id = (SELECT id FROM organizations WHERE slug = 'default')
  AND (
      (om.user_id IS NOT NULL AND om.user_id = (SELECT u.id FROM users u WHERE u.legacy_player_id = p.id))
      OR
      (om.user_id IS NULL AND om.username = p.name)
  )
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM league_players lp WHERE lp.legacy_player_id = p.id);

-- =============================================================================
-- Step 6: Migrate all seasons into the default league
-- =============================================================================
INSERT INTO seasons (id, created_at, organization_id, league_id, starts_at, legacy_season_id)
SELECT gen_random_uuid(),
       COALESCE(s.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       s.starts_at,
       s.id
FROM legacy_seasons s
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM seasons ns WHERE ns.legacy_season_id = s.id);

-- =============================================================================
-- Step 7: Migrate matches
--
-- For each legacy match, create:
--   - 1 Match row
--   - 2 MatchTeam rows (index 0 for team_one, index 1 for team_two)
--   - Up to 4 MatchTeamPlayer rows (skip null player IDs)
--
-- CreatedByMembershipId defaults to team_one's player_one's membership.
-- =============================================================================

-- Step 7a: Create Match rows
INSERT INTO matches (
    id, created_at, organization_id, league_id, season_id,
    source, created_by_membership_id, played_at, recorded_at, legacy_match_id
)
SELECT gen_random_uuid(),
       COALESCE(m.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       ns.id,                                      -- migrated season UUID
       0,                                          -- Manual source
       COALESCE(
           (SELECT lp_om.organization_membership_id FROM league_players lp_om
            WHERE lp_om.legacy_player_id = t1.player_one_id),
           (SELECT om.id FROM organization_memberships om
            WHERE om.organization_id = (SELECT id FROM organizations WHERE slug = 'default')
            LIMIT 1)
       ),                                          -- created_by: team_one player_one's membership
       COALESCE(m.created_at, now()),              -- played_at = created_at
       COALESCE(m.created_at, now()),              -- recorded_at = created_at
       m.id
FROM legacy_matches m
JOIN legacy_teams t1 ON t1.id = m.team_one_id
LEFT JOIN seasons ns ON ns.legacy_season_id = m.season_id
WHERE m.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM matches nm WHERE nm.legacy_match_id = m.id);

-- Step 7b: Create MatchTeam rows for team_one (index 0)
INSERT INTO match_teams (id, created_at, organization_id, league_id, match_id, index, score, is_winner)
SELECT gen_random_uuid(),
       COALESCE(m.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       nm.id,
       0,                                          -- index 0 = team_one
       COALESCE(t1.score, 0)::int,
       COALESCE(t1.winner, false)
FROM legacy_matches m
JOIN legacy_teams t1 ON t1.id = m.team_one_id
JOIN matches nm ON nm.legacy_match_id = m.id
WHERE m.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM match_teams mt WHERE mt.match_id = nm.id AND mt.index = 0
  );

-- Step 7c: Create MatchTeam rows for team_two (index 1)
INSERT INTO match_teams (id, created_at, organization_id, league_id, match_id, index, score, is_winner)
SELECT gen_random_uuid(),
       COALESCE(m.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       nm.id,
       1,                                          -- index 1 = team_two
       COALESCE(t2.score, 0)::int,
       COALESCE(t2.winner, false)
FROM legacy_matches m
JOIN legacy_teams t2 ON t2.id = m.team_two_id
JOIN matches nm ON nm.legacy_match_id = m.id
WHERE m.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM match_teams mt WHERE mt.match_id = nm.id AND mt.index = 1
  );

-- Step 7d: Create MatchTeamPlayer rows for team_one player_one (index 0)
INSERT INTO match_team_players (id, created_at, organization_id, league_id, match_team_id, league_player_id, index)
SELECT gen_random_uuid(),
       COALESCE(m.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       mt.id,
       lp.id,
       0
FROM legacy_matches m
JOIN legacy_teams t1 ON t1.id = m.team_one_id
JOIN matches nm ON nm.legacy_match_id = m.id
JOIN match_teams mt ON mt.match_id = nm.id AND mt.index = 0
JOIN league_players lp ON lp.legacy_player_id = t1.player_one_id
WHERE m.deleted_at IS NULL
  AND t1.player_one_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM match_team_players mtp WHERE mtp.match_team_id = mt.id AND mtp.index = 0
  );

-- Step 7e: Create MatchTeamPlayer rows for team_one player_two (index 1)
INSERT INTO match_team_players (id, created_at, organization_id, league_id, match_team_id, league_player_id, index)
SELECT gen_random_uuid(),
       COALESCE(m.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       mt.id,
       lp.id,
       1
FROM legacy_matches m
JOIN legacy_teams t1 ON t1.id = m.team_one_id
JOIN matches nm ON nm.legacy_match_id = m.id
JOIN match_teams mt ON mt.match_id = nm.id AND mt.index = 0
JOIN league_players lp ON lp.legacy_player_id = t1.player_two_id
WHERE m.deleted_at IS NULL
  AND t1.player_two_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM match_team_players mtp WHERE mtp.match_team_id = mt.id AND mtp.index = 1
  );

-- Step 7f: Create MatchTeamPlayer rows for team_two player_one (index 0)
INSERT INTO match_team_players (id, created_at, organization_id, league_id, match_team_id, league_player_id, index)
SELECT gen_random_uuid(),
       COALESCE(m.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       mt.id,
       lp.id,
       0
FROM legacy_matches m
JOIN legacy_teams t2 ON t2.id = m.team_two_id
JOIN matches nm ON nm.legacy_match_id = m.id
JOIN match_teams mt ON mt.match_id = nm.id AND mt.index = 1
JOIN league_players lp ON lp.legacy_player_id = t2.player_one_id
WHERE m.deleted_at IS NULL
  AND t2.player_one_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM match_team_players mtp WHERE mtp.match_team_id = mt.id AND mtp.index = 0
  );

-- Step 7g: Create MatchTeamPlayer rows for team_two player_two (index 1)
INSERT INTO match_team_players (id, created_at, organization_id, league_id, match_team_id, league_player_id, index)
SELECT gen_random_uuid(),
       COALESCE(m.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       mt.id,
       lp.id,
       1
FROM legacy_matches m
JOIN legacy_teams t2 ON t2.id = m.team_two_id
JOIN matches nm ON nm.legacy_match_id = m.id
JOIN match_teams mt ON mt.match_id = nm.id AND mt.index = 1
JOIN league_players lp ON lp.legacy_player_id = t2.player_two_id
WHERE m.deleted_at IS NULL
  AND t2.player_two_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM match_team_players mtp WHERE mtp.match_team_id = mt.id AND mtp.index = 1
  );

-- =============================================================================
-- Step 8: Migrate rating history
--
-- "Explode" each MmrCalculation row into up to 4 RatingHistory rows.
-- For each positional slot (team_one_player_one, team_one_player_two,
-- team_two_player_one, team_two_player_two):
--   - Delta from MmrCalculation positional column
--   - Mmr/Mu/Sigma from the matching PlayerHistory row
-- =============================================================================

-- Helper: use a CTE to unnest the 4 positions from each MmrCalculation
INSERT INTO rating_histories (id, created_at, organization_id, league_player_id, match_id, mmr, mu, sigma, delta)
SELECT gen_random_uuid(),
       COALESCE(mc.created_at, now()),
       (SELECT id FROM organizations WHERE slug = 'default'),
       lp.id,
       nm.id,
       COALESCE(ph.mmr, 0),
       COALESCE(ph.mu, 0),
       COALESCE(ph.sigma, 0),
       pos.delta
FROM legacy_mmr_calculations mc
JOIN legacy_matches m ON m.id = mc.match_id AND m.deleted_at IS NULL
JOIN legacy_teams t1 ON t1.id = m.team_one_id
JOIN legacy_teams t2 ON t2.id = m.team_two_id
JOIN matches nm ON nm.legacy_match_id = m.id
CROSS JOIN LATERAL (
    VALUES
        (t1.player_one_id, mc.team_one_player_one_mmr_delta),
        (t1.player_two_id, mc.team_one_player_two_mmr_delta),
        (t2.player_one_id, mc.team_two_player_one_mmr_delta),
        (t2.player_two_id, mc.team_two_player_two_mmr_delta)
) AS pos(player_id, delta)
JOIN league_players lp ON lp.legacy_player_id = pos.player_id
LEFT JOIN legacy_player_histories ph
    ON ph.player_id = pos.player_id
    AND ph.match_id = m.id
    AND ph.deleted_at IS NULL
WHERE mc.deleted_at IS NULL
  AND pos.player_id IS NOT NULL
  AND pos.delta IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM rating_histories rh
      WHERE rh.match_id = nm.id AND rh.league_player_id = lp.id
  );

-- =============================================================================
-- Step 9: Delete orphaned PATs (players without an identity)
-- =============================================================================
-- Per the issue: "delete any PATs belonging to players without an IdentityUserId"
-- We don't actually delete from legacy table — just skip them in step 10.

-- =============================================================================
-- Step 10: Migrate remaining PATs
-- =============================================================================
INSERT INTO personal_access_tokens (
    id, created_at, user_id, organization_id, league_id,
    scope, token_hash, name, last_used_at, expires_at, legacy_pat_id
)
SELECT gen_random_uuid(),
       COALESCE(pat."CreatedAt", now()),
       u.id,
       (SELECT id FROM organizations WHERE slug = 'default'),
       (SELECT l.id FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = 'default' AND l.slug = 'default'),
       'legacy',
       pat."TokenHash",
       pat."Name",
       pat."LastUsedAt",
       pat."ExpiresAt",
       pat."Id"
FROM legacy_personal_access_tokens pat
JOIN legacy_players p ON p.id = pat."PlayerId" AND p.deleted_at IS NULL
JOIN users u ON u.legacy_player_id = p.id
WHERE p.identity_user_id IS NOT NULL    -- skip orphaned PATs
  AND NOT EXISTS (SELECT 1 FROM personal_access_tokens npt WHERE npt.legacy_pat_id = pat."Id");

-- =============================================================================
-- Verification queries
-- =============================================================================
DO $$
DECLARE
    v_users         bigint;
    v_memberships   bigint;
    v_league_players bigint;
    v_seasons       bigint;
    v_matches       bigint;
    v_match_teams   bigint;
    v_match_players bigint;
    v_rating_hist   bigint;
    v_pats          bigint;
    v_legacy_players bigint;
    v_legacy_matches bigint;
BEGIN
    SELECT count(*) INTO v_legacy_players FROM legacy_players WHERE deleted_at IS NULL;
    SELECT count(*) INTO v_legacy_matches FROM legacy_matches WHERE deleted_at IS NULL;
    SELECT count(*) INTO v_users FROM users;
    SELECT count(*) INTO v_memberships FROM organization_memberships;
    SELECT count(*) INTO v_league_players FROM league_players;
    SELECT count(*) INTO v_seasons FROM seasons;
    SELECT count(*) INTO v_matches FROM matches;
    SELECT count(*) INTO v_match_teams FROM match_teams;
    SELECT count(*) INTO v_match_players FROM match_team_players;
    SELECT count(*) INTO v_rating_hist FROM rating_histories;
    SELECT count(*) INTO v_pats FROM personal_access_tokens;

    RAISE NOTICE '';
    RAISE NOTICE '=== Migration Summary ===';
    RAISE NOTICE 'Legacy players:        %', v_legacy_players;
    RAISE NOTICE 'Users created:         %', v_users;
    RAISE NOTICE 'Memberships created:   %', v_memberships;
    RAISE NOTICE 'League players:        %', v_league_players;
    RAISE NOTICE 'Seasons:               %', v_seasons;
    RAISE NOTICE 'Legacy matches:        %', v_legacy_matches;
    RAISE NOTICE 'Matches migrated:      %', v_matches;
    RAISE NOTICE 'Match teams:           % (expect ~2x matches)', v_match_teams;
    RAISE NOTICE 'Match team players:    % (expect ~4x matches)', v_match_players;
    RAISE NOTICE 'Rating histories:      % (expect ~4x matches)', v_rating_hist;
    RAISE NOTICE 'PATs:                  %', v_pats;
    RAISE NOTICE '=========================';
END $$;

COMMIT;
