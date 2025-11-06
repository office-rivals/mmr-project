using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerRoleAndAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "Players",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "RoleAssignedAt",
                table: "Players",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "RoleAssignedById",
                table: "Players",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Players_RoleAssignedById",
                table: "Players",
                column: "RoleAssignedById");

            migrationBuilder.AddForeignKey(
                name: "FK_Players_Players_RoleAssignedById",
                table: "Players",
                column: "RoleAssignedById",
                principalTable: "Players",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Players_Players_RoleAssignedById",
                table: "Players");

            migrationBuilder.DropIndex(
                name: "IX_Players_RoleAssignedById",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "RoleAssignedAt",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "RoleAssignedById",
                table: "Players");
        }
    }
}
