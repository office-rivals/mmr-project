-- =============================================================================
-- Verify migrated data (Issue #206, Phase 5)
--
-- Run after backfill-legacy-data.sql to validate the migration.
-- Reports any mismatches or missing data. A clean run should show
-- all checks passing with 0 failures.
--
-- Usage:
--   psql -h <host> -U <user> -d <db> -f scripts/verify-migration.sql
-- =============================================================================

DO $$
DECLARE
    v_count bigint;
    v_failures int := 0;
    v_checks int := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Migration Verification ===';
    RAISE NOTICE '';

    -- =========================================================================
    -- Check 1: Every non-deleted legacy player has a LeaguePlayer
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_players p
    WHERE p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM league_players lp WHERE lp.legacy_player_id = p.id);

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Every legacy player has a league player';
    ELSE
        RAISE WARNING '[FAIL] % legacy players missing a league player', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 2: Every claimed legacy player has a User
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_players p
    WHERE p.deleted_at IS NULL
      AND p.identity_user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.legacy_player_id = p.id);

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Every claimed legacy player has a user';
    ELSE
        RAISE WARNING '[FAIL] % claimed players missing a user', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 3: Every LeaguePlayer has an OrganizationMembership
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM league_players lp
    WHERE lp.legacy_player_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM organization_memberships om
          WHERE om.id = lp.organization_membership_id
      );

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Every migrated league player has a membership';
    ELSE
        RAISE WARNING '[FAIL] % league players missing a membership', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 4: Every non-deleted legacy match has a migrated match
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_matches m
    WHERE m.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM matches nm WHERE nm.legacy_match_id = m.id);

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Every legacy match has a migrated match';
    ELSE
        RAISE WARNING '[FAIL] % legacy matches missing a migrated match', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 5: Every migrated match has exactly 2 match teams
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM matches nm
    WHERE nm.legacy_match_id IS NOT NULL
      AND (SELECT count(*) FROM match_teams mt WHERE mt.match_id = nm.id) != 2;

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Every migrated match has exactly 2 teams';
    ELSE
        RAISE WARNING '[FAIL] % migrated matches do not have exactly 2 teams', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 6: Every non-deleted legacy season has a migrated season
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_seasons s
    WHERE s.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM seasons ns WHERE ns.legacy_season_id = s.id);

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Every legacy season has a migrated season';
    ELSE
        RAISE WARNING '[FAIL] % legacy seasons missing a migrated season', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 7: LeaguePlayer MMR/Mu/Sigma match legacy Player values
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_players p
    JOIN league_players lp ON lp.legacy_player_id = p.id
    WHERE p.deleted_at IS NULL
      AND (
          lp.mmr != COALESCE(p.mmr, 1500)
          OR lp.mu != COALESCE(p.mu, 25.0)
          OR lp.sigma != COALESCE(p.sigma, 8.333)
      );

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] LeaguePlayer ratings match legacy Player values';
    ELSE
        RAISE WARNING '[FAIL] % league players have mismatched ratings', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 8: Migrated match teams have correct scores
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_matches m
    JOIN legacy_teams t1 ON t1.id = m.team_one_id
    JOIN matches nm ON nm.legacy_match_id = m.id
    JOIN match_teams mt ON mt.match_id = nm.id AND mt.index = 0
    WHERE m.deleted_at IS NULL
      AND (mt.score != COALESCE(t1.score, 0)::int OR mt.is_winner != COALESCE(t1.winner, false));

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Team one scores and winner flags match';
    ELSE
        RAISE WARNING '[FAIL] % team_one entries have mismatched score/winner', v_count;
        v_failures := v_failures + 1;
    END IF;

    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_matches m
    JOIN legacy_teams t2 ON t2.id = m.team_two_id
    JOIN matches nm ON nm.legacy_match_id = m.id
    JOIN match_teams mt ON mt.match_id = nm.id AND mt.index = 1
    WHERE m.deleted_at IS NULL
      AND (mt.score != COALESCE(t2.score, 0)::int OR mt.is_winner != COALESCE(t2.winner, false));

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Team two scores and winner flags match';
    ELSE
        RAISE WARNING '[FAIL] % team_two entries have mismatched score/winner', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 9: Match team players point to correct league players
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_matches m
    JOIN legacy_teams t1 ON t1.id = m.team_one_id
    JOIN matches nm ON nm.legacy_match_id = m.id
    JOIN match_teams mt ON mt.match_id = nm.id AND mt.index = 0
    LEFT JOIN match_team_players mtp0 ON mtp0.match_team_id = mt.id AND mtp0.index = 0
    LEFT JOIN league_players lp0 ON lp0.id = mtp0.league_player_id
    WHERE m.deleted_at IS NULL
      AND t1.player_one_id IS NOT NULL
      AND (mtp0.id IS NULL OR lp0.legacy_player_id != t1.player_one_id);

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Team one player one correctly linked';
    ELSE
        RAISE WARNING '[FAIL] % team_one player_one entries mislinked', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 10: Rating history count matches MmrCalculation player positions
    -- =========================================================================
    v_checks := v_checks + 1;
    -- Count expected rating history rows (one per non-null position per MmrCalculation)
    WITH expected AS (
        SELECT count(*) AS cnt
        FROM legacy_mmr_calculations mc
        JOIN legacy_matches m ON m.id = mc.match_id AND m.deleted_at IS NULL
        JOIN legacy_teams t1 ON t1.id = m.team_one_id
        JOIN legacy_teams t2 ON t2.id = m.team_two_id
        CROSS JOIN LATERAL (
            VALUES
                (t1.player_one_id, mc.team_one_player_one_mmr_delta),
                (t1.player_two_id, mc.team_one_player_two_mmr_delta),
                (t2.player_one_id, mc.team_two_player_one_mmr_delta),
                (t2.player_two_id, mc.team_two_player_two_mmr_delta)
        ) AS pos(player_id, delta)
        WHERE mc.deleted_at IS NULL
          AND pos.player_id IS NOT NULL
          AND pos.delta IS NOT NULL
    ),
    actual AS (
        SELECT count(*) AS cnt FROM rating_histories
    )
    SELECT abs(e.cnt - a.cnt) INTO v_count FROM expected e, actual a;

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Rating history count matches expected';
    ELSE
        RAISE WARNING '[FAIL] Rating history count differs by %', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 11: Rating history deltas match MmrCalculation positional deltas
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
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
    JOIN rating_histories rh ON rh.match_id = nm.id AND rh.league_player_id = lp.id
    WHERE mc.deleted_at IS NULL
      AND pos.player_id IS NOT NULL
      AND pos.delta IS NOT NULL
      AND rh.delta != pos.delta;

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Rating history deltas match MmrCalculation values';
    ELSE
        RAISE WARNING '[FAIL] % rating history rows have mismatched deltas', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 12: Rating history Mmr/Mu/Sigma match PlayerHistory snapshots
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_mmr_calculations mc
    JOIN legacy_matches m ON m.id = mc.match_id AND m.deleted_at IS NULL
    JOIN legacy_teams t1 ON t1.id = m.team_one_id
    JOIN legacy_teams t2 ON t2.id = m.team_two_id
    JOIN matches nm ON nm.legacy_match_id = m.id
    CROSS JOIN LATERAL (
        VALUES
            (t1.player_one_id),
            (t1.player_two_id),
            (t2.player_one_id),
            (t2.player_two_id)
    ) AS pos(player_id)
    JOIN league_players lp ON lp.legacy_player_id = pos.player_id
    JOIN rating_histories rh ON rh.match_id = nm.id AND rh.league_player_id = lp.id
    JOIN legacy_player_histories ph ON ph.player_id = pos.player_id AND ph.match_id = m.id AND ph.deleted_at IS NULL
    WHERE mc.deleted_at IS NULL
      AND pos.player_id IS NOT NULL
      AND (rh.mmr != COALESCE(ph.mmr, 0) OR rh.mu != COALESCE(ph.mu, 0) OR rh.sigma != COALESCE(ph.sigma, 0));

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Rating history snapshots match PlayerHistory values';
    ELSE
        RAISE WARNING '[FAIL] % rating history rows have mismatched snapshots', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 13: Role mapping is correct
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_players p
    JOIN league_players lp ON lp.legacy_player_id = p.id
    JOIN organization_memberships om ON om.id = lp.organization_membership_id
    WHERE p.deleted_at IS NULL
      AND om.role != CASE p."Role"
          WHEN 2 THEN 0  -- Owner → Owner
          WHEN 1 THEN 1  -- Moderator → Moderator
          ELSE 2          -- User → Member
      END;

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Role mapping is correct';
    ELSE
        RAISE WARNING '[FAIL] % memberships have incorrect roles', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 14: Membership status is correct (Active for claimed, Invited for unclaimed)
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_players p
    JOIN league_players lp ON lp.legacy_player_id = p.id
    JOIN organization_memberships om ON om.id = lp.organization_membership_id
    WHERE p.deleted_at IS NULL
      AND om.status != CASE WHEN p.identity_user_id IS NOT NULL THEN 1 ELSE 0 END;

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] Membership status is correct';
    ELSE
        RAISE WARNING '[FAIL] % memberships have incorrect status', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 15: All migrated entities belong to the default org and league
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM matches nm
    WHERE nm.legacy_match_id IS NOT NULL
      AND nm.organization_id != (SELECT id FROM organizations WHERE slug = 'default');

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] All migrated matches belong to default org';
    ELSE
        RAISE WARNING '[FAIL] % migrated matches not in default org', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Check 16: PATs migrated correctly
    -- =========================================================================
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_count
    FROM legacy_personal_access_tokens pat
    JOIN legacy_players p ON p.id = pat."PlayerId" AND p.deleted_at IS NULL
    WHERE p.identity_user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM personal_access_tokens npt WHERE npt.legacy_pat_id = pat."Id");

    IF v_count = 0 THEN
        RAISE NOTICE '[PASS] All eligible PATs migrated';
    ELSE
        RAISE WARNING '[FAIL] % PATs not migrated', v_count;
        v_failures := v_failures + 1;
    END IF;

    -- =========================================================================
    -- Summary
    -- =========================================================================
    RAISE NOTICE '';
    IF v_failures = 0 THEN
        RAISE NOTICE '=== ALL % CHECKS PASSED ===', v_checks;
    ELSE
        RAISE WARNING '=== % of % CHECKS FAILED ===', v_failures, v_checks;
    END IF;
    RAISE NOTICE '';
END $$;
