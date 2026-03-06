using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUniquePendingFlagIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MatchFlags_MatchId",
                table: "MatchFlags");

            migrationBuilder.CreateIndex(
                name: "IX_MatchFlags_MatchId_FlaggedById_Pending",
                table: "MatchFlags",
                columns: new[] { "MatchId", "FlaggedById" },
                unique: true,
                filter: "\"Status\" = 0 AND \"DeletedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MatchFlags_MatchId_FlaggedById_Pending",
                table: "MatchFlags");

            migrationBuilder.CreateIndex(
                name: "IX_MatchFlags_MatchId",
                table: "MatchFlags",
                column: "MatchId");
        }
    }
}
