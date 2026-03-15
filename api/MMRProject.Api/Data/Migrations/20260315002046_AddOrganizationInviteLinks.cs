using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationInviteLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "v3_organization_invite_links",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    created_by_membership_id = table.Column<Guid>(type: "uuid", nullable: false),
                    max_uses = table.Column<int>(type: "integer", nullable: true),
                    use_count = table.Column<int>(type: "integer", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_v3_organization_invite_links", x => x.id);
                    table.ForeignKey(
                        name: "fk_v3_organization_invite_links_created_by",
                        column: x => x.created_by_membership_id,
                        principalTable: "v3_organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_v3_organization_invite_links_organization",
                        column: x => x.organization_id,
                        principalTable: "v3_organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_v3_organization_invite_links_code",
                table: "v3_organization_invite_links",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_v3_organization_invite_links_created_by_membership_id",
                table: "v3_organization_invite_links",
                column: "created_by_membership_id");

            migrationBuilder.CreateIndex(
                name: "IX_v3_organization_invite_links_organization_id",
                table: "v3_organization_invite_links",
                column: "organization_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "v3_organization_invite_links");
        }
    }
}
