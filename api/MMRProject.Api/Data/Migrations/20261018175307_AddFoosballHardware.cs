using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFoosballHardware : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "device_enrolment_token_created_at",
                table: "organizations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "device_enrolment_token_hash",
                table: "organizations",
                type: "bytea",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "foosball_tables",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    short_code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    end_label_a = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    end_label_b = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    sound_volume = table.Column<int>(type: "integer", nullable: false),
                    state_version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_foosball_tables", x => x.id);
                    table.ForeignKey(
                        name: "fk_foosball_tables_league",
                        column: x => x.league_id,
                        principalTable: "leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_foosball_tables_organization",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "player_cards",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_membership_id = table.Column<Guid>(type: "uuid", nullable: false),
                    uid_hmac = table.Column<byte[]>(type: "bytea", nullable: false),
                    linked_by_membership_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_player_cards", x => x.id);
                    table.ForeignKey(
                        name: "fk_player_cards_linked_by",
                        column: x => x.linked_by_membership_id,
                        principalTable: "organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_player_cards_membership",
                        column: x => x.organization_membership_id,
                        principalTable: "organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_player_cards_organization",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "card_link_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    table_id = table.Column<Guid>(type: "uuid", nullable: false),
                    uid_hmac = table.Column<byte[]>(type: "bytea", nullable: false),
                    short_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_card_link_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_card_link_requests_table",
                        column: x => x.table_id,
                        principalTable: "foosball_tables",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "device_wakes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    table_id = table.Column<Guid>(type: "uuid", nullable: false),
                    woke_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    idle_from = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_wakes", x => x.id);
                    table.ForeignKey(
                        name: "fk_device_wakes_table",
                        column: x => x.table_id,
                        principalTable: "foosball_tables",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hardware_id = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    secret_hash = table.Column<byte[]>(type: "bytea", nullable: true),
                    claimed = table.Column<bool>(type: "boolean", nullable: false),
                    claimed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    role = table.Column<int>(type: "integer", nullable: true),
                    table_id = table.Column<Guid>(type: "uuid", nullable: true),
                    end = table.Column<int>(type: "integer", nullable: true),
                    config_version = table.Column<int>(type: "integer", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    awake_since = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    battery_mv = table.Column<int>(type: "integer", nullable: true),
                    low_batt = table.Column<bool>(type: "boolean", nullable: false),
                    firmware_version = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    last_status_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_status = table.Column<string>(type: "jsonb", nullable: true),
                    beam_config = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_devices", x => x.id);
                    table.ForeignKey(
                        name: "fk_devices_organization",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_devices_table",
                        column: x => x.table_id,
                        principalTable: "foosball_tables",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "table_matches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    table_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    short_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ended_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_activity_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    score_a = table.Column<int>(type: "integer", nullable: false),
                    score_b = table.Column<int>(type: "integer", nullable: false),
                    active_match_id = table.Column<Guid>(type: "uuid", nullable: true),
                    active_match_team_index_at_end_a = table.Column<int>(type: "integer", nullable: false),
                    owns_active_match = table.Column<bool>(type: "boolean", nullable: false),
                    auto_submit_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    match_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ended_by_membership_id = table.Column<Guid>(type: "uuid", nullable: true),
                    teams_mode = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_table_matches", x => x.id);
                    table.ForeignKey(
                        name: "fk_table_matches_active_match",
                        column: x => x.active_match_id,
                        principalTable: "active_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_table_matches_match",
                        column: x => x.match_id,
                        principalTable: "matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_table_matches_table",
                        column: x => x.table_id,
                        principalTable: "foosball_tables",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "table_roster_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    table_id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    color = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_table_roster_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_table_roster_entries_league_player",
                        column: x => x.league_player_id,
                        principalTable: "league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_table_roster_entries_table",
                        column: x => x.table_id,
                        principalTable: "foosball_tables",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "table_goals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    table_match_id = table.Column<Guid>(type: "uuid", nullable: true),
                    table_id = table.Column<Guid>(type: "uuid", nullable: true),
                    orphan_reason = table.Column<int>(type: "integer", nullable: true),
                    scoring_end = table.Column<int>(type: "integer", nullable: true),
                    seq = table.Column<long>(type: "bigint", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    battery_mv = table.Column<int>(type: "integer", nullable: true),
                    undone_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    undo_event_id = table.Column<string>(type: "text", nullable: true),
                    scorer_league_player_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_table_goals", x => x.id);
                    table.ForeignKey(
                        name: "fk_table_goals_device",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_table_goals_scorer",
                        column: x => x.scorer_league_player_id,
                        principalTable: "league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_table_goals_table",
                        column: x => x.table_id,
                        principalTable: "foosball_tables",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_table_goals_table_match",
                        column: x => x.table_match_id,
                        principalTable: "table_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_organizations_device_enrolment_token_hash",
                table: "organizations",
                column: "device_enrolment_token_hash",
                unique: true,
                filter: "device_enrolment_token_hash IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_card_link_requests_expires",
                table: "card_link_requests",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_card_link_requests_short_code",
                table: "card_link_requests",
                column: "short_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_card_link_requests_table",
                table: "card_link_requests",
                column: "table_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_wakes_table_woke_at",
                table: "device_wakes",
                columns: new[] { "table_id", "woke_at" });

            migrationBuilder.CreateIndex(
                name: "ix_devices_hardware_id",
                table: "devices",
                column: "hardware_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_devices_organization",
                table: "devices",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_devices_table_goal_end",
                table: "devices",
                columns: new[] { "table_id", "end" },
                unique: true,
                filter: "role = 0 AND table_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_foosball_tables_league_id",
                table: "foosball_tables",
                column: "league_id");

            migrationBuilder.CreateIndex(
                name: "ix_foosball_tables_organization",
                table: "foosball_tables",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_foosball_tables_short_code",
                table: "foosball_tables",
                column: "short_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_player_cards_linked_by_membership_id",
                table: "player_cards",
                column: "linked_by_membership_id");

            migrationBuilder.CreateIndex(
                name: "ix_player_cards_membership",
                table: "player_cards",
                column: "organization_membership_id");

            migrationBuilder.CreateIndex(
                name: "ix_player_cards_org_uid",
                table: "player_cards",
                columns: new[] { "organization_id", "uid_hmac" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_table_goals_device_id",
                table: "table_goals",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ix_table_goals_event_id",
                table: "table_goals",
                column: "event_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_table_goals_org_orphans",
                table: "table_goals",
                columns: new[] { "organization_id", "received_at" },
                filter: "orphan_reason IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_table_goals_scorer_league_player_id",
                table: "table_goals",
                column: "scorer_league_player_id");

            migrationBuilder.CreateIndex(
                name: "IX_table_goals_table_id",
                table: "table_goals",
                column: "table_id");

            migrationBuilder.CreateIndex(
                name: "ix_table_goals_table_match",
                table: "table_goals",
                column: "table_match_id");

            migrationBuilder.CreateIndex(
                name: "ix_table_goals_undo_event_id",
                table: "table_goals",
                column: "undo_event_id",
                unique: true,
                filter: "undo_event_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_table_matches_active_match_id",
                table: "table_matches",
                column: "active_match_id");

            migrationBuilder.CreateIndex(
                name: "ix_table_matches_auto_submit",
                table: "table_matches",
                column: "auto_submit_at",
                filter: "auto_submit_at IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_table_matches_match_id",
                table: "table_matches",
                column: "match_id");

            migrationBuilder.CreateIndex(
                name: "ix_table_matches_org_status",
                table: "table_matches",
                columns: new[] { "organization_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_table_matches_short_code",
                table: "table_matches",
                column: "short_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_table_matches_table_started",
                table: "table_matches",
                columns: new[] { "table_id", "started_at" });

            migrationBuilder.CreateIndex(
                name: "ix_table_roster_entries_player",
                table: "table_roster_entries",
                column: "league_player_id");

            migrationBuilder.CreateIndex(
                name: "ix_table_roster_entries_table_player",
                table: "table_roster_entries",
                columns: new[] { "table_id", "league_player_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "card_link_requests");

            migrationBuilder.DropTable(
                name: "device_wakes");

            migrationBuilder.DropTable(
                name: "player_cards");

            migrationBuilder.DropTable(
                name: "table_goals");

            migrationBuilder.DropTable(
                name: "table_roster_entries");

            migrationBuilder.DropTable(
                name: "devices");

            migrationBuilder.DropTable(
                name: "table_matches");

            migrationBuilder.DropTable(
                name: "foosball_tables");

            migrationBuilder.DropIndex(
                name: "ix_organizations_device_enrolment_token_hash",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "device_enrolment_token_created_at",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "device_enrolment_token_hash",
                table: "organizations");
        }
    }
}
