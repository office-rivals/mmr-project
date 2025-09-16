using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSeasonSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "starts_at",
                table: "seasons",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "starts_at",
                table: "seasons");
        }
    }
}
