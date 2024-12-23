using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "seasons",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("seasons_pkey", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    name = table.Column<string>(type: "text", nullable: true),
                    mmr = table.Column<long>(type: "bigint", nullable: true),
                    mu = table.Column<decimal>(type: "numeric", nullable: true),
                    sigma = table.Column<decimal>(type: "numeric", nullable: true),
                    display_name = table.Column<string>(type: "text", nullable: true),
                    identity_user_id = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("users_pkey", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "teams",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    user_one_id = table.Column<long>(type: "bigint", nullable: true),
                    user_two_id = table.Column<long>(type: "bigint", nullable: true),
                    score = table.Column<long>(type: "bigint", nullable: true),
                    winner = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("teams_pkey", x => x.id);
                    table.ForeignKey(
                        name: "fk_teams_user_one",
                        column: x => x.user_one_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_teams_user_two",
                        column: x => x.user_two_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "matches",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    team_one_id = table.Column<long>(type: "bigint", nullable: true),
                    team_two_id = table.Column<long>(type: "bigint", nullable: true),
                    season_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("matches_pkey", x => x.id);
                    table.ForeignKey(
                        name: "fk_matches_season",
                        column: x => x.season_id,
                        principalTable: "seasons",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_matches_team_one",
                        column: x => x.team_one_id,
                        principalTable: "teams",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_matches_team_two",
                        column: x => x.team_two_id,
                        principalTable: "teams",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "mmr_calculations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    match_id = table.Column<long>(type: "bigint", nullable: true),
                    team_one_player_one_mmr_delta = table.Column<long>(type: "bigint", nullable: true),
                    team_one_player_two_mmr_delta = table.Column<long>(type: "bigint", nullable: true),
                    team_two_player_one_mmr_delta = table.Column<long>(type: "bigint", nullable: true),
                    team_two_player_two_mmr_delta = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("mmr_calculations_pkey", x => x.id);
                    table.ForeignKey(
                        name: "fk_matches_mmr_calculations",
                        column: x => x.match_id,
                        principalTable: "matches",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "player_histories",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    mmr = table.Column<long>(type: "bigint", nullable: true),
                    mu = table.Column<decimal>(type: "numeric", nullable: true),
                    sigma = table.Column<decimal>(type: "numeric", nullable: true),
                    match_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("player_histories_pkey", x => x.id);
                    table.ForeignKey(
                        name: "fk_player_histories_match",
                        column: x => x.match_id,
                        principalTable: "matches",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_player_histories_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "idx_matches_deleted_at",
                table: "matches",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "IX_matches_season_id",
                table: "matches",
                column: "season_id");

            migrationBuilder.CreateIndex(
                name: "IX_matches_team_one_id",
                table: "matches",
                column: "team_one_id");

            migrationBuilder.CreateIndex(
                name: "IX_matches_team_two_id",
                table: "matches",
                column: "team_two_id");

            migrationBuilder.CreateIndex(
                name: "idx_mmr_calculations_deleted_at",
                table: "mmr_calculations",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "IX_mmr_calculations_match_id",
                table: "mmr_calculations",
                column: "match_id");

            migrationBuilder.CreateIndex(
                name: "idx_player_histories_deleted_at",
                table: "player_histories",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "IX_player_histories_match_id",
                table: "player_histories",
                column: "match_id");

            migrationBuilder.CreateIndex(
                name: "IX_player_histories_user_id",
                table: "player_histories",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_seasons_deleted_at",
                table: "seasons",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "idx_teams_deleted_at",
                table: "teams",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "IX_teams_user_one_id",
                table: "teams",
                column: "user_one_id");

            migrationBuilder.CreateIndex(
                name: "IX_teams_user_two_id",
                table: "teams",
                column: "user_two_id");

            migrationBuilder.CreateIndex(
                name: "idx_users_deleted_at",
                table: "users",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "uni_users_identity_user_id",
                table: "users",
                column: "identity_user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uni_users_name",
                table: "users",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "users_id_key",
                table: "users",
                column: "id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mmr_calculations");

            migrationBuilder.DropTable(
                name: "player_histories");

            migrationBuilder.DropTable(
                name: "matches");

            migrationBuilder.DropTable(
                name: "seasons");

            migrationBuilder.DropTable(
                name: "teams");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
