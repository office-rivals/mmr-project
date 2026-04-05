using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchFlagUpdatedAtAndUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_v3_match_flags_match_id",
                table: "v3_match_flags");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "v3_match_flags",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.CreateIndex(
                name: "ix_v3_match_flags_match_flagged_by_open",
                table: "v3_match_flags",
                columns: new[] { "match_id", "flagged_by_membership_id" },
                unique: true,
                filter: "status = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_v3_match_flags_match_flagged_by_open",
                table: "v3_match_flags");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "v3_match_flags");

            migrationBuilder.CreateIndex(
                name: "IX_v3_match_flags_match_id",
                table: "v3_match_flags",
                column: "match_id");
        }
    }
}
