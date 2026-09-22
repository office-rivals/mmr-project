using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMembershipClaimRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "membership_claim_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_membership_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "text", nullable: true),
                    review_note = table.Column<string>(type: "text", nullable: true),
                    reviewed_by_membership_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    retired_membership_id = table.Column<Guid>(type: "uuid", nullable: true),
                    requester_verified_email = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_membership_claim_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_membership_claim_requests_organization",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_membership_claim_requests_retired_membership",
                        column: x => x.retired_membership_id,
                        principalTable: "organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_membership_claim_requests_reviewed_by",
                        column: x => x.reviewed_by_membership_id,
                        principalTable: "organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_membership_claim_requests_target_membership",
                        column: x => x.organization_membership_id,
                        principalTable: "organization_memberships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_membership_claim_requests_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_membership_claim_requests_org_status",
                table: "membership_claim_requests",
                columns: new[] { "organization_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_membership_claim_requests_pending_target",
                table: "membership_claim_requests",
                column: "organization_membership_id",
                unique: true,
                filter: "status = 0");

            migrationBuilder.CreateIndex(
                name: "ix_membership_claim_requests_pending_user",
                table: "membership_claim_requests",
                columns: new[] { "organization_id", "user_id" },
                unique: true,
                filter: "status = 0");

            migrationBuilder.CreateIndex(
                name: "IX_membership_claim_requests_retired_membership_id",
                table: "membership_claim_requests",
                column: "retired_membership_id");

            migrationBuilder.CreateIndex(
                name: "IX_membership_claim_requests_reviewed_by_membership_id",
                table: "membership_claim_requests",
                column: "reviewed_by_membership_id");

            migrationBuilder.CreateIndex(
                name: "IX_membership_claim_requests_user_id",
                table: "membership_claim_requests",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "membership_claim_requests");
        }
    }
}
