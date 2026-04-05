using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddV3MatchIntegrityConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_rating_histories_player_match",
                table: "rating_histories");

            migrationBuilder.DropIndex(
                name: "ix_personal_access_tokens_token_hash",
                table: "personal_access_tokens");

            migrationBuilder.DropIndex(
                name: "ix_match_teams_match",
                table: "match_teams");

            migrationBuilder.CreateIndex(
                name: "ix_rating_histories_player_match",
                table: "rating_histories",
                columns: new[] { "league_player_id", "match_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_personal_access_tokens_token_hash",
                table: "personal_access_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_match_teams_match_index",
                table: "match_teams",
                columns: new[] { "match_id", "index" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_match_team_players_team_player",
                table: "match_team_players",
                columns: new[] { "match_team_id", "league_player_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_rating_histories_player_match",
                table: "rating_histories");

            migrationBuilder.DropIndex(
                name: "ix_personal_access_tokens_token_hash",
                table: "personal_access_tokens");

            migrationBuilder.DropIndex(
                name: "ix_match_teams_match_index",
                table: "match_teams");

            migrationBuilder.DropIndex(
                name: "ix_match_team_players_team_player",
                table: "match_team_players");

            migrationBuilder.CreateIndex(
                name: "ix_rating_histories_player_match",
                table: "rating_histories",
                columns: new[] { "league_player_id", "match_id" });

            migrationBuilder.CreateIndex(
                name: "ix_personal_access_tokens_token_hash",
                table: "personal_access_tokens",
                column: "token_hash");

            migrationBuilder.CreateIndex(
                name: "ix_match_teams_match",
                table: "match_teams",
                column: "match_id");

        }
    }
}
