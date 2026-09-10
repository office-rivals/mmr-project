using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRfidPairing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pairing_codes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pairing_codes", x => x.id);
                    table.ForeignKey(
                        name: "fk_pairing_codes_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rfid_tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rfid_uid = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rfid_tags", x => x.id);
                    table.ForeignKey(
                        name: "fk_rfid_tags_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_pairing_codes_code",
                table: "pairing_codes",
                column: "code");

            migrationBuilder.CreateIndex(
                name: "ix_pairing_codes_user",
                table: "pairing_codes",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_rfid_tags_rfid_uid",
                table: "rfid_tags",
                column: "rfid_uid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_rfid_tags_user",
                table: "rfid_tags",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pairing_codes");

            migrationBuilder.DropTable(
                name: "rfid_tags");
        }
    }
}
