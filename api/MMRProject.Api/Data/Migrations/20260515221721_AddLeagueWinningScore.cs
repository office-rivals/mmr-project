using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLeagueWinningScore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "winning_score",
                table: "leagues",
                type: "integer",
                nullable: true);

            // Backfill existing leagues with 10 to preserve current submit-time
            // behaviour (winner reaches 10, loser scores 0–9). New leagues
            // created after this migration default to 10 via CreateLeagueRequest,
            // but the column is nullable so admins can switch to free-form.
            migrationBuilder.Sql("UPDATE leagues SET winning_score = 10 WHERE winning_score IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "winning_score",
                table: "leagues");
        }
    }
}
