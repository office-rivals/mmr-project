using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHardwareHeartbeat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hardware",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hardware_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    local_ip_address = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hardware", x => x.id);
                    table.ForeignKey(
                        name: "fk_hardware_league",
                        column: x => x.league_id,
                        principalTable: "leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_hardware_organization",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_hardware_hardware_id",
                table: "hardware",
                column: "hardware_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_hardware_league_id",
                table: "hardware",
                column: "league_id");

            migrationBuilder.CreateIndex(
                name: "ix_hardware_org_league",
                table: "hardware",
                columns: new[] { "organization_id", "league_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hardware");
        }
    }
}
