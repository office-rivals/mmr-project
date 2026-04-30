using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueIndexOnActiveMatchPendingMatchId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_v3_active_matches_pending_match_id",
                table: "active_matches");

            migrationBuilder.CreateIndex(
                name: "ix_active_matches_pending_match_id",
                table: "active_matches",
                column: "pending_match_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_active_matches_pending_match_id",
                table: "active_matches");

            migrationBuilder.CreateIndex(
                name: "IX_v3_active_matches_pending_match_id",
                table: "active_matches",
                column: "pending_match_id");
        }
    }
}
