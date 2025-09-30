using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MigrateFromUsersToPlayers2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_users_TeamOnePlayerOneId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_users_TeamOnePlayerTwoId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_users_TeamTwoPlayerOneId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_users_TeamTwoPlayerTwoId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_QueuedPlayers_users_PlayerId",
                table: "QueuedPlayers");

            migrationBuilder.DropPrimaryKey(
                name: "users_pkey",
                table: "users");

            migrationBuilder.RenameTable(
                name: "users",
                newName: "Players");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Players",
                table: "Players",
                column: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_Players_TeamOnePlayerOneId",
                table: "ActiveMatches",
                column: "TeamOnePlayerOneId",
                principalTable: "Players",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_Players_TeamOnePlayerTwoId",
                table: "ActiveMatches",
                column: "TeamOnePlayerTwoId",
                principalTable: "Players",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_Players_TeamTwoPlayerOneId",
                table: "ActiveMatches",
                column: "TeamTwoPlayerOneId",
                principalTable: "Players",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_Players_TeamTwoPlayerTwoId",
                table: "ActiveMatches",
                column: "TeamTwoPlayerTwoId",
                principalTable: "Players",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_QueuedPlayers_Players_PlayerId",
                table: "QueuedPlayers",
                column: "PlayerId",
                principalTable: "Players",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_Players_TeamOnePlayerOneId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_Players_TeamOnePlayerTwoId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_Players_TeamTwoPlayerOneId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_Players_TeamTwoPlayerTwoId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_QueuedPlayers_Players_PlayerId",
                table: "QueuedPlayers");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Players",
                table: "Players");

            migrationBuilder.RenameTable(
                name: "Players",
                newName: "users");

            migrationBuilder.AddPrimaryKey(
                name: "users_pkey",
                table: "users",
                column: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_users_TeamOnePlayerOneId",
                table: "ActiveMatches",
                column: "TeamOnePlayerOneId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_users_TeamOnePlayerTwoId",
                table: "ActiveMatches",
                column: "TeamOnePlayerTwoId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_users_TeamTwoPlayerOneId",
                table: "ActiveMatches",
                column: "TeamTwoPlayerOneId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_users_TeamTwoPlayerTwoId",
                table: "ActiveMatches",
                column: "TeamTwoPlayerTwoId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_QueuedPlayers_users_PlayerId",
                table: "QueuedPlayers",
                column: "PlayerId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
