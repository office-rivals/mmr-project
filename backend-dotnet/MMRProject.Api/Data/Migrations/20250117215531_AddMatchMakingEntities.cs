using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchMakingEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActiveMatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TeamOneUserOneId = table.Column<long>(type: "bigint", nullable: false),
                    TeamOneUserTwoId = table.Column<long>(type: "bigint", nullable: false),
                    TeamTwoUserOneId = table.Column<long>(type: "bigint", nullable: false),
                    TeamTwoUserTwoId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActiveMatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActiveMatches_users_TeamOneUserOneId",
                        column: x => x.TeamOneUserOneId,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActiveMatches_users_TeamOneUserTwoId",
                        column: x => x.TeamOneUserTwoId,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActiveMatches_users_TeamTwoUserOneId",
                        column: x => x.TeamTwoUserOneId,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActiveMatches_users_TeamTwoUserTwoId",
                        column: x => x.TeamTwoUserTwoId,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PendingMatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ActiveMatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingMatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PendingMatches_ActiveMatches_ActiveMatchId",
                        column: x => x.ActiveMatchId,
                        principalTable: "ActiveMatches",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "QueuedPlayers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    PendingMatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastAcceptedMatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QueuedPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QueuedPlayers_PendingMatches_PendingMatchId",
                        column: x => x.PendingMatchId,
                        principalTable: "PendingMatches",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QueuedPlayers_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActiveMatches_TeamOneUserOneId",
                table: "ActiveMatches",
                column: "TeamOneUserOneId");

            migrationBuilder.CreateIndex(
                name: "IX_ActiveMatches_TeamOneUserTwoId",
                table: "ActiveMatches",
                column: "TeamOneUserTwoId");

            migrationBuilder.CreateIndex(
                name: "IX_ActiveMatches_TeamTwoUserOneId",
                table: "ActiveMatches",
                column: "TeamTwoUserOneId");

            migrationBuilder.CreateIndex(
                name: "IX_ActiveMatches_TeamTwoUserTwoId",
                table: "ActiveMatches",
                column: "TeamTwoUserTwoId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingMatches_ActiveMatchId",
                table: "PendingMatches",
                column: "ActiveMatchId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QueuedPlayers_PendingMatchId",
                table: "QueuedPlayers",
                column: "PendingMatchId");

            migrationBuilder.CreateIndex(
                name: "IX_QueuedPlayers_UserId",
                table: "QueuedPlayers",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QueuedPlayers");

            migrationBuilder.DropTable(
                name: "PendingMatches");

            migrationBuilder.DropTable(
                name: "ActiveMatches");
        }
    }
}
