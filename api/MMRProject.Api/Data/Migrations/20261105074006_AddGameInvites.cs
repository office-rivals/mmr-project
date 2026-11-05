using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGameInvites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "game_invites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    share_code = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    end_reason = table.Column<int>(type: "integer", nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    current_round_id = table.Column<Guid>(type: "uuid", nullable: true),
                    acceptance_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    pending_match_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ended_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_game_invites", x => x.id);
                    table.ForeignKey(
                        name: "fk_game_invites_created_by",
                        column: x => x.created_by_league_player_id,
                        principalTable: "league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_game_invites_league",
                        column: x => x.league_id,
                        principalTable: "leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_game_invites_pending_match",
                        column: x => x.pending_match_id,
                        principalTable: "pending_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "game_invite_participants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_invite_id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    representative_league_player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    acceptance_status = table.Column<int>(type: "integer", nullable: false),
                    accepted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    team_index = table.Column<int>(type: "integer", nullable: true),
                    slot_index = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_game_invite_participants", x => x.id);
                    table.ForeignKey(
                        name: "fk_game_invite_participants_invite",
                        column: x => x.game_invite_id,
                        principalTable: "game_invites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_game_invite_participants_player",
                        column: x => x.league_player_id,
                        principalTable: "league_players",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_game_invite_participants_invite",
                table: "game_invite_participants",
                column: "game_invite_id");

            migrationBuilder.CreateIndex(
                name: "ix_game_invite_participants_league_player",
                table: "game_invite_participants",
                columns: new[] { "league_id", "league_player_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_game_invite_participants_league_player_id",
                table: "game_invite_participants",
                column: "league_player_id");

            migrationBuilder.CreateIndex(
                name: "IX_game_invites_created_by_league_player_id",
                table: "game_invites",
                column: "created_by_league_player_id");

            migrationBuilder.CreateIndex(
                name: "ix_game_invites_league_status",
                table: "game_invites",
                columns: new[] { "league_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_game_invites_pending_match_id",
                table: "game_invites",
                column: "pending_match_id");

            migrationBuilder.CreateIndex(
                name: "ix_game_invites_share_code",
                table: "game_invites",
                column: "share_code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "game_invite_participants");

            migrationBuilder.DropTable(
                name: "game_invites");
        }
    }
}
