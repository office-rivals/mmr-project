using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameTablesRemoveV3Prefix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Rename legacy tables to legacy_* prefix (must happen first to free up names like "matches", "seasons")
            migrationBuilder.RenameTable(name: "matches", newName: "legacy_matches");
            migrationBuilder.RenameTable(name: "mmr_calculations", newName: "legacy_mmr_calculations");
            migrationBuilder.RenameTable(name: "player_histories", newName: "legacy_player_histories");
            migrationBuilder.RenameTable(name: "seasons", newName: "legacy_seasons");
            migrationBuilder.RenameTable(name: "teams", newName: "legacy_teams");
            migrationBuilder.RenameTable(name: "Players", newName: "legacy_players");
            migrationBuilder.RenameTable(name: "QueuedPlayers", newName: "legacy_queued_players");
            migrationBuilder.RenameTable(name: "PendingMatches", newName: "legacy_pending_matches");
            migrationBuilder.RenameTable(name: "ActiveMatches", newName: "legacy_active_matches");
            migrationBuilder.RenameTable(name: "PersonalAccessTokens", newName: "legacy_personal_access_tokens");
            migrationBuilder.RenameTable(name: "MatchFlags", newName: "legacy_match_flags");

            // Step 2: Rename legacy FK constraints
            migrationBuilder.Sql("ALTER TABLE legacy_matches RENAME CONSTRAINT fk_matches_season TO fk_legacy_matches_season;");
            migrationBuilder.Sql("ALTER TABLE legacy_matches RENAME CONSTRAINT fk_matches_team_one TO fk_legacy_matches_team_one;");
            migrationBuilder.Sql("ALTER TABLE legacy_matches RENAME CONSTRAINT fk_matches_team_two TO fk_legacy_matches_team_two;");
            migrationBuilder.Sql("ALTER TABLE legacy_mmr_calculations RENAME CONSTRAINT fk_matches_mmr_calculations TO fk_legacy_matches_mmr_calculations;");
            migrationBuilder.Sql("ALTER TABLE legacy_player_histories RENAME CONSTRAINT fk_player_histories_match TO fk_legacy_player_histories_match;");
            migrationBuilder.Sql("ALTER TABLE legacy_player_histories RENAME CONSTRAINT fk_player_histories_player TO fk_legacy_player_histories_player;");
            migrationBuilder.Sql("ALTER TABLE legacy_teams RENAME CONSTRAINT fk_teams_player_one TO fk_legacy_teams_player_one;");
            migrationBuilder.Sql("ALTER TABLE legacy_teams RENAME CONSTRAINT fk_teams_play_two TO fk_legacy_teams_play_two;");

            // Step 3: Remove v3_ prefix from all v3 tables
            migrationBuilder.RenameTable(name: "v3_users", newName: "users");
            migrationBuilder.RenameTable(name: "v3_organizations", newName: "organizations");
            migrationBuilder.RenameTable(name: "v3_organization_memberships", newName: "organization_memberships");
            migrationBuilder.RenameTable(name: "v3_leagues", newName: "leagues");
            migrationBuilder.RenameTable(name: "v3_league_players", newName: "league_players");
            migrationBuilder.RenameTable(name: "v3_seasons", newName: "seasons");
            migrationBuilder.RenameTable(name: "v3_matches", newName: "matches");
            migrationBuilder.RenameTable(name: "v3_match_teams", newName: "match_teams");
            migrationBuilder.RenameTable(name: "v3_match_team_players", newName: "match_team_players");
            migrationBuilder.RenameTable(name: "v3_pending_matches", newName: "pending_matches");
            migrationBuilder.RenameTable(name: "v3_pending_match_teams", newName: "pending_match_teams");
            migrationBuilder.RenameTable(name: "v3_pending_match_team_players", newName: "pending_match_team_players");
            migrationBuilder.RenameTable(name: "v3_pending_match_acceptances", newName: "pending_match_acceptances");
            migrationBuilder.RenameTable(name: "v3_active_matches", newName: "active_matches");
            migrationBuilder.RenameTable(name: "v3_queue_entries", newName: "queue_entries");
            migrationBuilder.RenameTable(name: "v3_rating_histories", newName: "rating_histories");
            migrationBuilder.RenameTable(name: "v3_personal_access_tokens", newName: "personal_access_tokens");
            migrationBuilder.RenameTable(name: "v3_match_flags", newName: "match_flags");
            migrationBuilder.RenameTable(name: "v3_organization_invite_links", newName: "organization_invite_links");

            // Step 4: Rename v3 indexes (remove v3_ prefix)
            migrationBuilder.RenameIndex(name: "ix_v3_users_identity_user_id", table: "users", newName: "ix_users_identity_user_id");
            migrationBuilder.RenameIndex(name: "ix_v3_users_email", table: "users", newName: "ix_users_email");
            migrationBuilder.RenameIndex(name: "ix_v3_organizations_slug", table: "organizations", newName: "ix_organizations_slug");
            migrationBuilder.RenameIndex(name: "ix_v3_organization_memberships_org_user", table: "organization_memberships", newName: "ix_organization_memberships_org_user");
            migrationBuilder.RenameIndex(name: "ix_v3_organization_memberships_org_invite_email", table: "organization_memberships", newName: "ix_organization_memberships_org_invite_email");
            migrationBuilder.RenameIndex(name: "ix_v3_leagues_org_slug", table: "leagues", newName: "ix_leagues_org_slug");
            migrationBuilder.RenameIndex(name: "ix_v3_league_players_league_membership", table: "league_players", newName: "ix_league_players_league_membership");
            migrationBuilder.RenameIndex(name: "ix_v3_seasons_league", table: "seasons", newName: "ix_seasons_league");
            migrationBuilder.RenameIndex(name: "ix_v3_matches_league_season", table: "matches", newName: "ix_matches_league_season");
            migrationBuilder.RenameIndex(name: "ix_v3_match_teams_match", table: "match_teams", newName: "ix_match_teams_match");
            migrationBuilder.RenameIndex(name: "ix_v3_queue_entries_league_player", table: "queue_entries", newName: "ix_queue_entries_league_player");
            migrationBuilder.RenameIndex(name: "ix_v3_rating_histories_player_match", table: "rating_histories", newName: "ix_rating_histories_player_match");
            migrationBuilder.RenameIndex(name: "ix_v3_personal_access_tokens_token_hash", table: "personal_access_tokens", newName: "ix_personal_access_tokens_token_hash");
            migrationBuilder.RenameIndex(name: "ix_v3_organization_invite_links_code", table: "organization_invite_links", newName: "ix_organization_invite_links_code");
            migrationBuilder.RenameIndex(name: "ix_v3_match_flags_league_match", table: "match_flags", newName: "ix_match_flags_league_match");
            migrationBuilder.RenameIndex(name: "ix_v3_match_flags_match_flagged_by_open", table: "match_flags", newName: "ix_match_flags_match_flagged_by_open");

            // Step 5: Rename v3 FK constraints (remove v3_ prefix)
            migrationBuilder.Sql("ALTER TABLE organization_memberships RENAME CONSTRAINT fk_v3_organization_memberships_organization TO fk_organization_memberships_organization;");
            migrationBuilder.Sql("ALTER TABLE organization_memberships RENAME CONSTRAINT fk_v3_organization_memberships_user TO fk_organization_memberships_user;");
            migrationBuilder.Sql("ALTER TABLE organization_memberships RENAME CONSTRAINT fk_v3_organization_memberships_role_assigned_by TO fk_organization_memberships_role_assigned_by;");
            migrationBuilder.Sql("ALTER TABLE leagues RENAME CONSTRAINT fk_v3_leagues_organization TO fk_leagues_organization;");
            migrationBuilder.Sql("ALTER TABLE league_players RENAME CONSTRAINT fk_v3_league_players_league TO fk_league_players_league;");
            migrationBuilder.Sql("ALTER TABLE league_players RENAME CONSTRAINT fk_v3_league_players_membership TO fk_league_players_membership;");
            migrationBuilder.Sql("ALTER TABLE seasons RENAME CONSTRAINT fk_v3_seasons_league TO fk_seasons_league;");
            migrationBuilder.Sql("ALTER TABLE matches RENAME CONSTRAINT fk_v3_matches_league TO fk_matches_league;");
            migrationBuilder.Sql("ALTER TABLE matches RENAME CONSTRAINT fk_v3_matches_season TO fk_matches_season;");
            migrationBuilder.Sql("ALTER TABLE matches RENAME CONSTRAINT fk_v3_matches_created_by TO fk_matches_created_by;");
            migrationBuilder.Sql("ALTER TABLE match_teams RENAME CONSTRAINT fk_v3_match_teams_match TO fk_match_teams_match;");
            migrationBuilder.Sql("ALTER TABLE match_team_players RENAME CONSTRAINT fk_v3_match_team_players_team TO fk_match_team_players_team;");
            migrationBuilder.Sql("ALTER TABLE match_team_players RENAME CONSTRAINT fk_v3_match_team_players_player TO fk_match_team_players_player;");
            migrationBuilder.Sql("ALTER TABLE pending_match_teams RENAME CONSTRAINT fk_v3_pending_match_teams_pending_match TO fk_pending_match_teams_pending_match;");
            migrationBuilder.Sql("ALTER TABLE pending_match_team_players RENAME CONSTRAINT fk_v3_pending_match_team_players_team TO fk_pending_match_team_players_team;");
            migrationBuilder.Sql("ALTER TABLE pending_match_team_players RENAME CONSTRAINT fk_v3_pending_match_team_players_player TO fk_pending_match_team_players_player;");
            migrationBuilder.Sql("ALTER TABLE pending_match_acceptances RENAME CONSTRAINT fk_v3_pending_match_acceptances_pending_match TO fk_pending_match_acceptances_pending_match;");
            migrationBuilder.Sql("ALTER TABLE pending_match_acceptances RENAME CONSTRAINT fk_v3_pending_match_acceptances_player TO fk_pending_match_acceptances_player;");
            migrationBuilder.Sql("ALTER TABLE active_matches RENAME CONSTRAINT fk_v3_active_matches_pending_match TO fk_active_matches_pending_match;");
            migrationBuilder.Sql("ALTER TABLE queue_entries RENAME CONSTRAINT fk_v3_queue_entries_league TO fk_queue_entries_league;");
            migrationBuilder.Sql("ALTER TABLE queue_entries RENAME CONSTRAINT fk_v3_queue_entries_player TO fk_queue_entries_player;");
            migrationBuilder.Sql("ALTER TABLE rating_histories RENAME CONSTRAINT fk_v3_rating_histories_player TO fk_rating_histories_player;");
            migrationBuilder.Sql("ALTER TABLE rating_histories RENAME CONSTRAINT fk_v3_rating_histories_match TO fk_rating_histories_match;");
            migrationBuilder.Sql("ALTER TABLE personal_access_tokens RENAME CONSTRAINT fk_v3_personal_access_tokens_user TO fk_personal_access_tokens_user;");
            migrationBuilder.Sql("ALTER TABLE personal_access_tokens RENAME CONSTRAINT fk_v3_personal_access_tokens_organization TO fk_personal_access_tokens_organization;");
            migrationBuilder.Sql("ALTER TABLE personal_access_tokens RENAME CONSTRAINT fk_v3_personal_access_tokens_league TO fk_personal_access_tokens_league;");
            migrationBuilder.Sql("ALTER TABLE organization_invite_links RENAME CONSTRAINT fk_v3_organization_invite_links_organization TO fk_organization_invite_links_organization;");
            migrationBuilder.Sql("ALTER TABLE organization_invite_links RENAME CONSTRAINT fk_v3_organization_invite_links_created_by TO fk_organization_invite_links_created_by;");
            migrationBuilder.Sql("ALTER TABLE match_flags RENAME CONSTRAINT fk_v3_match_flags_match TO fk_match_flags_match;");
            migrationBuilder.Sql("ALTER TABLE match_flags RENAME CONSTRAINT fk_v3_match_flags_flagged_by TO fk_match_flags_flagged_by;");
            migrationBuilder.Sql("ALTER TABLE match_flags RENAME CONSTRAINT fk_v3_match_flags_resolved_by TO fk_match_flags_resolved_by;");

            // Step 6: Rename v3 primary keys (remove v3_ prefix)
            migrationBuilder.Sql("ALTER TABLE users RENAME CONSTRAINT \"PK_v3_users\" TO \"PK_users\";");
            migrationBuilder.Sql("ALTER TABLE organizations RENAME CONSTRAINT \"PK_v3_organizations\" TO \"PK_organizations\";");
            migrationBuilder.Sql("ALTER TABLE organization_memberships RENAME CONSTRAINT \"PK_v3_organization_memberships\" TO \"PK_organization_memberships\";");
            migrationBuilder.Sql("ALTER TABLE leagues RENAME CONSTRAINT \"PK_v3_leagues\" TO \"PK_leagues\";");
            migrationBuilder.Sql("ALTER TABLE league_players RENAME CONSTRAINT \"PK_v3_league_players\" TO \"PK_league_players\";");
            migrationBuilder.Sql("ALTER TABLE seasons RENAME CONSTRAINT \"PK_v3_seasons\" TO \"PK_seasons\";");
            migrationBuilder.Sql("ALTER TABLE matches RENAME CONSTRAINT \"PK_v3_matches\" TO \"PK_matches\";");
            migrationBuilder.Sql("ALTER TABLE match_teams RENAME CONSTRAINT \"PK_v3_match_teams\" TO \"PK_match_teams\";");
            migrationBuilder.Sql("ALTER TABLE match_team_players RENAME CONSTRAINT \"PK_v3_match_team_players\" TO \"PK_match_team_players\";");
            migrationBuilder.Sql("ALTER TABLE pending_matches RENAME CONSTRAINT \"PK_v3_pending_matches\" TO \"PK_pending_matches\";");
            migrationBuilder.Sql("ALTER TABLE pending_match_teams RENAME CONSTRAINT \"PK_v3_pending_match_teams\" TO \"PK_pending_match_teams\";");
            migrationBuilder.Sql("ALTER TABLE pending_match_team_players RENAME CONSTRAINT \"PK_v3_pending_match_team_players\" TO \"PK_pending_match_team_players\";");
            migrationBuilder.Sql("ALTER TABLE pending_match_acceptances RENAME CONSTRAINT \"PK_v3_pending_match_acceptances\" TO \"PK_pending_match_acceptances\";");
            migrationBuilder.Sql("ALTER TABLE active_matches RENAME CONSTRAINT \"PK_v3_active_matches\" TO \"PK_active_matches\";");
            migrationBuilder.Sql("ALTER TABLE queue_entries RENAME CONSTRAINT \"PK_v3_queue_entries\" TO \"PK_queue_entries\";");
            migrationBuilder.Sql("ALTER TABLE rating_histories RENAME CONSTRAINT \"PK_v3_rating_histories\" TO \"PK_rating_histories\";");
            migrationBuilder.Sql("ALTER TABLE personal_access_tokens RENAME CONSTRAINT \"PK_v3_personal_access_tokens\" TO \"PK_personal_access_tokens\";");
            migrationBuilder.Sql("ALTER TABLE match_flags RENAME CONSTRAINT \"PK_v3_match_flags\" TO \"PK_match_flags\";");
            migrationBuilder.Sql("ALTER TABLE organization_invite_links RENAME CONSTRAINT \"PK_v3_organization_invite_links\" TO \"PK_organization_invite_links\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Step 1: Rename v3 primary keys back
            migrationBuilder.Sql("ALTER TABLE users RENAME CONSTRAINT \"PK_users\" TO \"PK_v3_users\";");
            migrationBuilder.Sql("ALTER TABLE organizations RENAME CONSTRAINT \"PK_organizations\" TO \"PK_v3_organizations\";");
            migrationBuilder.Sql("ALTER TABLE organization_memberships RENAME CONSTRAINT \"PK_organization_memberships\" TO \"PK_v3_organization_memberships\";");
            migrationBuilder.Sql("ALTER TABLE leagues RENAME CONSTRAINT \"PK_leagues\" TO \"PK_v3_leagues\";");
            migrationBuilder.Sql("ALTER TABLE league_players RENAME CONSTRAINT \"PK_league_players\" TO \"PK_v3_league_players\";");
            migrationBuilder.Sql("ALTER TABLE seasons RENAME CONSTRAINT \"PK_seasons\" TO \"PK_v3_seasons\";");
            migrationBuilder.Sql("ALTER TABLE matches RENAME CONSTRAINT \"PK_matches\" TO \"PK_v3_matches\";");
            migrationBuilder.Sql("ALTER TABLE match_teams RENAME CONSTRAINT \"PK_match_teams\" TO \"PK_v3_match_teams\";");
            migrationBuilder.Sql("ALTER TABLE match_team_players RENAME CONSTRAINT \"PK_match_team_players\" TO \"PK_v3_match_team_players\";");
            migrationBuilder.Sql("ALTER TABLE pending_matches RENAME CONSTRAINT \"PK_pending_matches\" TO \"PK_v3_pending_matches\";");
            migrationBuilder.Sql("ALTER TABLE pending_match_teams RENAME CONSTRAINT \"PK_pending_match_teams\" TO \"PK_v3_pending_match_teams\";");
            migrationBuilder.Sql("ALTER TABLE pending_match_team_players RENAME CONSTRAINT \"PK_pending_match_team_players\" TO \"PK_v3_pending_match_team_players\";");
            migrationBuilder.Sql("ALTER TABLE pending_match_acceptances RENAME CONSTRAINT \"PK_pending_match_acceptances\" TO \"PK_v3_pending_match_acceptances\";");
            migrationBuilder.Sql("ALTER TABLE active_matches RENAME CONSTRAINT \"PK_active_matches\" TO \"PK_v3_active_matches\";");
            migrationBuilder.Sql("ALTER TABLE queue_entries RENAME CONSTRAINT \"PK_queue_entries\" TO \"PK_v3_queue_entries\";");
            migrationBuilder.Sql("ALTER TABLE rating_histories RENAME CONSTRAINT \"PK_rating_histories\" TO \"PK_v3_rating_histories\";");
            migrationBuilder.Sql("ALTER TABLE personal_access_tokens RENAME CONSTRAINT \"PK_personal_access_tokens\" TO \"PK_v3_personal_access_tokens\";");
            migrationBuilder.Sql("ALTER TABLE match_flags RENAME CONSTRAINT \"PK_match_flags\" TO \"PK_v3_match_flags\";");
            migrationBuilder.Sql("ALTER TABLE organization_invite_links RENAME CONSTRAINT \"PK_organization_invite_links\" TO \"PK_v3_organization_invite_links\";");

            // Step 2: Rename v3 FK constraints back
            migrationBuilder.Sql("ALTER TABLE organization_memberships RENAME CONSTRAINT fk_organization_memberships_organization TO fk_v3_organization_memberships_organization;");
            migrationBuilder.Sql("ALTER TABLE organization_memberships RENAME CONSTRAINT fk_organization_memberships_user TO fk_v3_organization_memberships_user;");
            migrationBuilder.Sql("ALTER TABLE organization_memberships RENAME CONSTRAINT fk_organization_memberships_role_assigned_by TO fk_v3_organization_memberships_role_assigned_by;");
            migrationBuilder.Sql("ALTER TABLE leagues RENAME CONSTRAINT fk_leagues_organization TO fk_v3_leagues_organization;");
            migrationBuilder.Sql("ALTER TABLE league_players RENAME CONSTRAINT fk_league_players_league TO fk_v3_league_players_league;");
            migrationBuilder.Sql("ALTER TABLE league_players RENAME CONSTRAINT fk_league_players_membership TO fk_v3_league_players_membership;");
            migrationBuilder.Sql("ALTER TABLE seasons RENAME CONSTRAINT fk_seasons_league TO fk_v3_seasons_league;");
            migrationBuilder.Sql("ALTER TABLE matches RENAME CONSTRAINT fk_matches_league TO fk_v3_matches_league;");
            migrationBuilder.Sql("ALTER TABLE matches RENAME CONSTRAINT fk_matches_season TO fk_v3_matches_season;");
            migrationBuilder.Sql("ALTER TABLE matches RENAME CONSTRAINT fk_matches_created_by TO fk_v3_matches_created_by;");
            migrationBuilder.Sql("ALTER TABLE match_teams RENAME CONSTRAINT fk_match_teams_match TO fk_v3_match_teams_match;");
            migrationBuilder.Sql("ALTER TABLE match_team_players RENAME CONSTRAINT fk_match_team_players_team TO fk_v3_match_team_players_team;");
            migrationBuilder.Sql("ALTER TABLE match_team_players RENAME CONSTRAINT fk_match_team_players_player TO fk_v3_match_team_players_player;");
            migrationBuilder.Sql("ALTER TABLE pending_match_teams RENAME CONSTRAINT fk_pending_match_teams_pending_match TO fk_v3_pending_match_teams_pending_match;");
            migrationBuilder.Sql("ALTER TABLE pending_match_team_players RENAME CONSTRAINT fk_pending_match_team_players_team TO fk_v3_pending_match_team_players_team;");
            migrationBuilder.Sql("ALTER TABLE pending_match_team_players RENAME CONSTRAINT fk_pending_match_team_players_player TO fk_v3_pending_match_team_players_player;");
            migrationBuilder.Sql("ALTER TABLE pending_match_acceptances RENAME CONSTRAINT fk_pending_match_acceptances_pending_match TO fk_v3_pending_match_acceptances_pending_match;");
            migrationBuilder.Sql("ALTER TABLE pending_match_acceptances RENAME CONSTRAINT fk_pending_match_acceptances_player TO fk_v3_pending_match_acceptances_player;");
            migrationBuilder.Sql("ALTER TABLE active_matches RENAME CONSTRAINT fk_active_matches_pending_match TO fk_v3_active_matches_pending_match;");
            migrationBuilder.Sql("ALTER TABLE queue_entries RENAME CONSTRAINT fk_queue_entries_league TO fk_v3_queue_entries_league;");
            migrationBuilder.Sql("ALTER TABLE queue_entries RENAME CONSTRAINT fk_queue_entries_player TO fk_v3_queue_entries_player;");
            migrationBuilder.Sql("ALTER TABLE rating_histories RENAME CONSTRAINT fk_rating_histories_player TO fk_v3_rating_histories_player;");
            migrationBuilder.Sql("ALTER TABLE rating_histories RENAME CONSTRAINT fk_rating_histories_match TO fk_v3_rating_histories_match;");
            migrationBuilder.Sql("ALTER TABLE personal_access_tokens RENAME CONSTRAINT fk_personal_access_tokens_user TO fk_v3_personal_access_tokens_user;");
            migrationBuilder.Sql("ALTER TABLE personal_access_tokens RENAME CONSTRAINT fk_personal_access_tokens_organization TO fk_v3_personal_access_tokens_organization;");
            migrationBuilder.Sql("ALTER TABLE personal_access_tokens RENAME CONSTRAINT fk_personal_access_tokens_league TO fk_v3_personal_access_tokens_league;");
            migrationBuilder.Sql("ALTER TABLE organization_invite_links RENAME CONSTRAINT fk_organization_invite_links_organization TO fk_v3_organization_invite_links_organization;");
            migrationBuilder.Sql("ALTER TABLE organization_invite_links RENAME CONSTRAINT fk_organization_invite_links_created_by TO fk_v3_organization_invite_links_created_by;");
            migrationBuilder.Sql("ALTER TABLE match_flags RENAME CONSTRAINT fk_match_flags_match TO fk_v3_match_flags_match;");
            migrationBuilder.Sql("ALTER TABLE match_flags RENAME CONSTRAINT fk_match_flags_flagged_by TO fk_v3_match_flags_flagged_by;");
            migrationBuilder.Sql("ALTER TABLE match_flags RENAME CONSTRAINT fk_match_flags_resolved_by TO fk_v3_match_flags_resolved_by;");

            // Step 3: Rename v3 indexes back
            migrationBuilder.RenameIndex(name: "ix_users_identity_user_id", table: "users", newName: "ix_v3_users_identity_user_id");
            migrationBuilder.RenameIndex(name: "ix_users_email", table: "users", newName: "ix_v3_users_email");
            migrationBuilder.RenameIndex(name: "ix_organizations_slug", table: "organizations", newName: "ix_v3_organizations_slug");
            migrationBuilder.RenameIndex(name: "ix_organization_memberships_org_user", table: "organization_memberships", newName: "ix_v3_organization_memberships_org_user");
            migrationBuilder.RenameIndex(name: "ix_organization_memberships_org_invite_email", table: "organization_memberships", newName: "ix_v3_organization_memberships_org_invite_email");
            migrationBuilder.RenameIndex(name: "ix_leagues_org_slug", table: "leagues", newName: "ix_v3_leagues_org_slug");
            migrationBuilder.RenameIndex(name: "ix_league_players_league_membership", table: "league_players", newName: "ix_v3_league_players_league_membership");
            migrationBuilder.RenameIndex(name: "ix_seasons_league", table: "seasons", newName: "ix_v3_seasons_league");
            migrationBuilder.RenameIndex(name: "ix_matches_league_season", table: "matches", newName: "ix_v3_matches_league_season");
            migrationBuilder.RenameIndex(name: "ix_match_teams_match", table: "match_teams", newName: "ix_v3_match_teams_match");
            migrationBuilder.RenameIndex(name: "ix_queue_entries_league_player", table: "queue_entries", newName: "ix_v3_queue_entries_league_player");
            migrationBuilder.RenameIndex(name: "ix_rating_histories_player_match", table: "rating_histories", newName: "ix_v3_rating_histories_player_match");
            migrationBuilder.RenameIndex(name: "ix_personal_access_tokens_token_hash", table: "personal_access_tokens", newName: "ix_v3_personal_access_tokens_token_hash");
            migrationBuilder.RenameIndex(name: "ix_organization_invite_links_code", table: "organization_invite_links", newName: "ix_v3_organization_invite_links_code");
            migrationBuilder.RenameIndex(name: "ix_match_flags_league_match", table: "match_flags", newName: "ix_v3_match_flags_league_match");
            migrationBuilder.RenameIndex(name: "ix_match_flags_match_flagged_by_open", table: "match_flags", newName: "ix_v3_match_flags_match_flagged_by_open");

            // Step 4: Rename v3 tables back to v3_ prefix
            migrationBuilder.RenameTable(name: "users", newName: "v3_users");
            migrationBuilder.RenameTable(name: "organizations", newName: "v3_organizations");
            migrationBuilder.RenameTable(name: "organization_memberships", newName: "v3_organization_memberships");
            migrationBuilder.RenameTable(name: "leagues", newName: "v3_leagues");
            migrationBuilder.RenameTable(name: "league_players", newName: "v3_league_players");
            migrationBuilder.RenameTable(name: "seasons", newName: "v3_seasons");
            migrationBuilder.RenameTable(name: "matches", newName: "v3_matches");
            migrationBuilder.RenameTable(name: "match_teams", newName: "v3_match_teams");
            migrationBuilder.RenameTable(name: "match_team_players", newName: "v3_match_team_players");
            migrationBuilder.RenameTable(name: "pending_matches", newName: "v3_pending_matches");
            migrationBuilder.RenameTable(name: "pending_match_teams", newName: "v3_pending_match_teams");
            migrationBuilder.RenameTable(name: "pending_match_team_players", newName: "v3_pending_match_team_players");
            migrationBuilder.RenameTable(name: "pending_match_acceptances", newName: "v3_pending_match_acceptances");
            migrationBuilder.RenameTable(name: "active_matches", newName: "v3_active_matches");
            migrationBuilder.RenameTable(name: "queue_entries", newName: "v3_queue_entries");
            migrationBuilder.RenameTable(name: "rating_histories", newName: "v3_rating_histories");
            migrationBuilder.RenameTable(name: "personal_access_tokens", newName: "v3_personal_access_tokens");
            migrationBuilder.RenameTable(name: "match_flags", newName: "v3_match_flags");
            migrationBuilder.RenameTable(name: "organization_invite_links", newName: "v3_organization_invite_links");

            // Step 5: Rename legacy FK constraints back
            migrationBuilder.Sql("ALTER TABLE legacy_matches RENAME CONSTRAINT fk_legacy_matches_season TO fk_matches_season;");
            migrationBuilder.Sql("ALTER TABLE legacy_matches RENAME CONSTRAINT fk_legacy_matches_team_one TO fk_matches_team_one;");
            migrationBuilder.Sql("ALTER TABLE legacy_matches RENAME CONSTRAINT fk_legacy_matches_team_two TO fk_matches_team_two;");
            migrationBuilder.Sql("ALTER TABLE legacy_mmr_calculations RENAME CONSTRAINT fk_legacy_matches_mmr_calculations TO fk_matches_mmr_calculations;");
            migrationBuilder.Sql("ALTER TABLE legacy_player_histories RENAME CONSTRAINT fk_legacy_player_histories_match TO fk_player_histories_match;");
            migrationBuilder.Sql("ALTER TABLE legacy_player_histories RENAME CONSTRAINT fk_legacy_player_histories_player TO fk_player_histories_player;");
            migrationBuilder.Sql("ALTER TABLE legacy_teams RENAME CONSTRAINT fk_legacy_teams_player_one TO fk_teams_player_one;");
            migrationBuilder.Sql("ALTER TABLE legacy_teams RENAME CONSTRAINT fk_legacy_teams_play_two TO fk_teams_play_two;");

            // Step 6: Rename legacy tables back
            migrationBuilder.RenameTable(name: "legacy_matches", newName: "matches");
            migrationBuilder.RenameTable(name: "legacy_mmr_calculations", newName: "mmr_calculations");
            migrationBuilder.RenameTable(name: "legacy_player_histories", newName: "player_histories");
            migrationBuilder.RenameTable(name: "legacy_seasons", newName: "seasons");
            migrationBuilder.RenameTable(name: "legacy_teams", newName: "teams");
            migrationBuilder.RenameTable(name: "legacy_players", newName: "Players");
            migrationBuilder.RenameTable(name: "legacy_queued_players", newName: "QueuedPlayers");
            migrationBuilder.RenameTable(name: "legacy_pending_matches", newName: "PendingMatches");
            migrationBuilder.RenameTable(name: "legacy_active_matches", newName: "ActiveMatches");
            migrationBuilder.RenameTable(name: "legacy_personal_access_tokens", newName: "PersonalAccessTokens");
            migrationBuilder.RenameTable(name: "legacy_match_flags", newName: "MatchFlags");
        }
    }
}
