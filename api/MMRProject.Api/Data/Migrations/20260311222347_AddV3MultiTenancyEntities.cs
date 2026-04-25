using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddV3MultiTenancyEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "v3_organizations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    slug = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_organizations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "v3_pending_matches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_pending_matches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "v3_users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    identity_user_id = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    username = table.Column<string>(type: "text", nullable: true),
                    display_name = table.Column<string>(type: "text", nullable: true),
                    legacy_player_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "v3_leagues",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    slug = table.Column<string>(type: "text", nullable: false),
                    queue_size = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_leagues", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_leagues_organization",
                        column: x => x.organization_id,
                        principalTable: "v3_organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_active_matches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pending_match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_active_matches", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_active_matches_pending_match",
                        column: x => x.pending_match_id,
                        principalTable: "v3_pending_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_pending_match_teams",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pending_match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    index = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_pending_match_teams", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_pending_match_teams_pending_match",
                        column: x => x.pending_match_id,
                        principalTable: "v3_pending_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_organization_memberships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    invite_email = table.Column<string>(type: "text", nullable: true),
                    display_name = table.Column<string>(type: "text", nullable: true),
                    username = table.Column<string>(type: "text", nullable: true),
                    role = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    role_assigned_by_membership_id = table.Column<Guid>(type: "uuid", nullable: true),
                    role_assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    claimed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_organization_memberships", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_organization_memberships_organization",
                        column: x => x.organization_id,
                        principalTable: "v3_organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_organization_memberships_role_assigned_by",
                        column: x => x.role_assigned_by_membership_id,
                        principalTable: "v3_organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_organization_memberships_user",
                        column: x => x.user_id,
                        principalTable: "v3_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_personal_access_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: true),
                    league_id = table.Column<Guid>(type: "uuid", nullable: true),
                    scope = table.Column<string>(type: "text", nullable: false),
                    token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    last_used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    legacy_pat_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_personal_access_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_personal_access_tokens_league",
                        column: x => x.league_id,
                        principalTable: "v3_leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_personal_access_tokens_organization",
                        column: x => x.organization_id,
                        principalTable: "v3_organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_personal_access_tokens_user",
                        column: x => x.user_id,
                        principalTable: "v3_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_seasons",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    legacy_season_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_seasons", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_seasons_league",
                        column: x => x.league_id,
                        principalTable: "v3_leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_league_players",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_membership_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mmr = table.Column<long>(type: "bigint", nullable: false),
                    mu = table.Column<decimal>(type: "numeric", nullable: false),
                    sigma = table.Column<decimal>(type: "numeric", nullable: false),
                    legacy_player_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_league_players", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_league_players_league",
                        column: x => x.league_id,
                        principalTable: "v3_leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_league_players_membership",
                        column: x => x.organization_membership_id,
                        principalTable: "v3_organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_matches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    season_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source = table.Column<int>(type: "integer", nullable: false),
                    created_by_membership_id = table.Column<Guid>(type: "uuid", nullable: false),
                    played_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    legacy_match_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_matches", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_matches_created_by",
                        column: x => x.created_by_membership_id,
                        principalTable: "v3_organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_matches_league",
                        column: x => x.league_id,
                        principalTable: "v3_leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_matches_season",
                        column: x => x.season_id,
                        principalTable: "v3_seasons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_pending_match_acceptances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pending_match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    accepted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_pending_match_acceptances", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_pending_match_acceptances_pending_match",
                        column: x => x.pending_match_id,
                        principalTable: "v3_pending_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_pending_match_acceptances_player",
                        column: x => x.league_player_id,
                        principalTable: "v3_league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_pending_match_team_players",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pending_match_team_id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    index = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_pending_match_team_players", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_pending_match_team_players_player",
                        column: x => x.league_player_id,
                        principalTable: "v3_league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_pending_match_team_players_team",
                        column: x => x.pending_match_team_id,
                        principalTable: "v3_pending_match_teams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_queue_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_queue_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_queue_entries_league",
                        column: x => x.league_id,
                        principalTable: "v3_leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_queue_entries_player",
                        column: x => x.league_player_id,
                        principalTable: "v3_league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_match_flags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    flagged_by_membership_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    resolution_note = table.Column<string>(type: "text", nullable: true),
                    resolved_by_membership_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_match_flags", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_match_flags_flagged_by",
                        column: x => x.flagged_by_membership_id,
                        principalTable: "v3_organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_match_flags_match",
                        column: x => x.match_id,
                        principalTable: "v3_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_match_flags_resolved_by",
                        column: x => x.resolved_by_membership_id,
                        principalTable: "v3_organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_match_teams",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    index = table.Column<int>(type: "integer", nullable: false),
                    score = table.Column<int>(type: "integer", nullable: false),
                    is_winner = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_match_teams", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_match_teams_match",
                        column: x => x.match_id,
                        principalTable: "v3_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_rating_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mmr = table.Column<long>(type: "bigint", nullable: false),
                    mu = table.Column<decimal>(type: "numeric", nullable: false),
                    sigma = table.Column<decimal>(type: "numeric", nullable: false),
                    delta = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_rating_histories", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_rating_histories_match",
                        column: x => x.match_id,
                        principalTable: "v3_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_rating_histories_player",
                        column: x => x.league_player_id,
                        principalTable: "v3_league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "v3_match_team_players",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    match_team_id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    index = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_match_team_players", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_match_team_players_player",
                        column: x => x.league_player_id,
                        principalTable: "v3_league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_match_team_players_team",
                        column: x => x.match_team_id,
                        principalTable: "v3_match_teams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_v3_active_matches_pending_match_id",
                table: "v3_active_matches",
                column: "pending_match_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_league_players_league_membership",
                table: "v3_league_players",
                columns: new[] { "league_id", "organization_membership_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_v3_league_players_organization_membership_id",
                table: "v3_league_players",
                column: "organization_membership_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_leagues_org_slug",
                table: "v3_leagues",
                columns: new[] { "organization_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_v3_match_flags_flagged_by_membership_id",
                table: "v3_match_flags",
                column: "flagged_by_membership_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_match_flags_league_match",
                table: "v3_match_flags",
                columns: new[] { "league_id", "match_id" });

            migrationBuilder.CreateIndex(
                name: "IX_v3_match_flags_match_id",
                table: "v3_match_flags",
                column: "match_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_match_flags_resolved_by_membership_id",
                table: "v3_match_flags",
                column: "resolved_by_membership_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_match_team_players_league_player_id",
                table: "v3_match_team_players",
                column: "league_player_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_match_team_players_match_team_id",
                table: "v3_match_team_players",
                column: "match_team_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_match_teams_match",
                table: "v3_match_teams",
                column: "match_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_matches_created_by_membership_id",
                table: "v3_matches",
                column: "created_by_membership_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_matches_league_season",
                table: "v3_matches",
                columns: new[] { "league_id", "season_id" });

            migrationBuilder.CreateIndex(
                name: "IX_v3_matches_season_id",
                table: "v3_matches",
                column: "season_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_organization_memberships_org_invite_email",
                table: "v3_organization_memberships",
                columns: new[] { "organization_id", "invite_email" },
                unique: true,
                filter: "invite_email IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_v3_organization_memberships_org_user",
                table: "v3_organization_memberships",
                columns: new[] { "organization_id", "user_id" },
                unique: true,
                filter: "user_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_v3_organization_memberships_role_assigned_by_membership_id",
                table: "v3_organization_memberships",
                column: "role_assigned_by_membership_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_organization_memberships_user_id",
                table: "v3_organization_memberships",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_organizations_slug",
                table: "v3_organizations",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_v3_pending_match_acceptances_league_player_id",
                table: "v3_pending_match_acceptances",
                column: "league_player_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_pending_match_acceptances_pending_match_id",
                table: "v3_pending_match_acceptances",
                column: "pending_match_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_pending_match_team_players_league_player_id",
                table: "v3_pending_match_team_players",
                column: "league_player_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_pending_match_team_players_pending_match_team_id",
                table: "v3_pending_match_team_players",
                column: "pending_match_team_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_pending_match_teams_pending_match_id",
                table: "v3_pending_match_teams",
                column: "pending_match_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_personal_access_tokens_league_id",
                table: "v3_personal_access_tokens",
                column: "league_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_personal_access_tokens_organization_id",
                table: "v3_personal_access_tokens",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_personal_access_tokens_token_hash",
                table: "v3_personal_access_tokens",
                column: "token_hash");

            migrationBuilder.CreateIndex(
                name: "IX_v3_personal_access_tokens_user_id",
                table: "v3_personal_access_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_queue_entries_league_player",
                table: "v3_queue_entries",
                columns: new[] { "league_id", "league_player_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_v3_queue_entries_league_player_id",
                table: "v3_queue_entries",
                column: "league_player_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_rating_histories_match_id",
                table: "v3_rating_histories",
                column: "match_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_rating_histories_player_match",
                table: "v3_rating_histories",
                columns: new[] { "league_player_id", "match_id" });

            migrationBuilder.CreateIndex(
                name: "ix_v3_seasons_league",
                table: "v3_seasons",
                column: "league_id");

            migrationBuilder.CreateIndex(
                name: "ix_v3_users_email",
                table: "v3_users",
                column: "email");

            migrationBuilder.CreateIndex(
                name: "ix_v3_users_identity_user_id",
                table: "v3_users",
                column: "identity_user_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "v3_active_matches");

            migrationBuilder.DropTable(
                name: "v3_match_flags");

            migrationBuilder.DropTable(
                name: "v3_match_team_players");

            migrationBuilder.DropTable(
                name: "v3_pending_match_acceptances");

            migrationBuilder.DropTable(
                name: "v3_pending_match_team_players");

            migrationBuilder.DropTable(
                name: "v3_personal_access_tokens");

            migrationBuilder.DropTable(
                name: "v3_queue_entries");

            migrationBuilder.DropTable(
                name: "v3_rating_histories");

            migrationBuilder.DropTable(
                name: "v3_match_teams");

            migrationBuilder.DropTable(
                name: "v3_pending_match_teams");

            migrationBuilder.DropTable(
                name: "v3_league_players");

            migrationBuilder.DropTable(
                name: "v3_matches");

            migrationBuilder.DropTable(
                name: "v3_pending_matches");

            migrationBuilder.DropTable(
                name: "v3_organization_memberships");

            migrationBuilder.DropTable(
                name: "v3_seasons");

            migrationBuilder.DropTable(
                name: "v3_users");

            migrationBuilder.DropTable(
                name: "v3_leagues");

            migrationBuilder.DropTable(
                name: "v3_organizations");
        }
    }
}
