using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MigrateFromUsersToPlayers1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_users_TeamOneUserOneId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_users_TeamOneUserTwoId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_users_TeamTwoUserOneId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ActiveMatches_users_TeamTwoUserTwoId",
                table: "ActiveMatches");

            migrationBuilder.DropForeignKey(
                name: "fk_player_histories_user",
                table: "player_histories");

            migrationBuilder.DropForeignKey(
                name: "FK_QueuedPlayers_users_UserId",
                table: "QueuedPlayers");

            migrationBuilder.DropForeignKey(
                name: "fk_teams_user_one",
                table: "teams");

            migrationBuilder.DropForeignKey(
                name: "fk_teams_user_two",
                table: "teams");

            migrationBuilder.RenameIndex(
                name: "users_id_key",
                table: "users",
                newName: "players_id_key");

            migrationBuilder.RenameIndex(
                name: "uni_users_name",
                table: "users",
                newName: "uni_players_name");

            migrationBuilder.RenameIndex(
                name: "uni_users_identity_user_id",
                table: "users",
                newName: "uni_players_identity_user_id");

            migrationBuilder.RenameIndex(
                name: "idx_users_deleted_at",
                table: "users",
                newName: "idx_players_deleted_at");

            migrationBuilder.RenameColumn(
                name: "user_two_id",
                table: "teams",
                newName: "player_two_id");

            migrationBuilder.RenameColumn(
                name: "user_one_id",
                table: "teams",
                newName: "player_one_id");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "QueuedPlayers",
                newName: "PlayerId");

            migrationBuilder.RenameIndex(
                name: "IX_QueuedPlayers_UserId",
                table: "QueuedPlayers",
                newName: "IX_QueuedPlayers_PlayerId");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "player_histories",
                newName: "player_id");

            migrationBuilder.RenameColumn(
                name: "TeamTwoUserTwoId",
                table: "ActiveMatches",
                newName: "TeamTwoPlayerTwoId");

            migrationBuilder.RenameColumn(
                name: "TeamTwoUserOneId",
                table: "ActiveMatches",
                newName: "TeamTwoPlayerOneId");

            migrationBuilder.RenameColumn(
                name: "TeamOneUserTwoId",
                table: "ActiveMatches",
                newName: "TeamOnePlayerTwoId");

            migrationBuilder.RenameColumn(
                name: "TeamOneUserOneId",
                table: "ActiveMatches",
                newName: "TeamOnePlayerOneId");

            migrationBuilder.RenameIndex(
                name: "IX_ActiveMatches_TeamTwoUserTwoId",
                table: "ActiveMatches",
                newName: "IX_ActiveMatches_TeamTwoPlayerTwoId");

            migrationBuilder.RenameIndex(
                name: "IX_ActiveMatches_TeamTwoUserOneId",
                table: "ActiveMatches",
                newName: "IX_ActiveMatches_TeamTwoPlayerOneId");

            migrationBuilder.RenameIndex(
                name: "IX_ActiveMatches_TeamOneUserTwoId",
                table: "ActiveMatches",
                newName: "IX_ActiveMatches_TeamOnePlayerTwoId");

            migrationBuilder.RenameIndex(
                name: "IX_ActiveMatches_TeamOneUserOneId",
                table: "ActiveMatches",
                newName: "IX_ActiveMatches_TeamOnePlayerOneId");

            migrationBuilder.CreateIndex(
                name: "IX_teams_player_one_id",
                table: "teams",
                column: "player_one_id");

            migrationBuilder.CreateIndex(
                name: "IX_teams_player_two_id",
                table: "teams",
                column: "player_two_id");

            migrationBuilder.CreateIndex(
                name: "IX_player_histories_player_id",
                table: "player_histories",
                column: "player_id");

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
                name: "fk_player_histories_player",
                table: "player_histories",
                column: "player_id",
                principalTable: "users",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_QueuedPlayers_users_PlayerId",
                table: "QueuedPlayers",
                column: "PlayerId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_teams_play_two",
                table: "teams",
                column: "player_two_id",
                principalTable: "users",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_teams_player_one",
                table: "teams",
                column: "player_one_id",
                principalTable: "users",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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
                name: "fk_player_histories_player",
                table: "player_histories");

            migrationBuilder.DropForeignKey(
                name: "FK_QueuedPlayers_users_PlayerId",
                table: "QueuedPlayers");

            migrationBuilder.DropForeignKey(
                name: "fk_teams_play_two",
                table: "teams");

            migrationBuilder.DropForeignKey(
                name: "fk_teams_player_one",
                table: "teams");

            migrationBuilder.DropIndex(
                name: "IX_teams_player_one_id",
                table: "teams");

            migrationBuilder.DropIndex(
                name: "IX_teams_player_two_id",
                table: "teams");

            migrationBuilder.DropIndex(
                name: "IX_player_histories_player_id",
                table: "player_histories");

            migrationBuilder.RenameIndex(
                name: "uni_players_name",
                table: "users",
                newName: "uni_users_name");

            migrationBuilder.RenameIndex(
                name: "uni_players_identity_user_id",
                table: "users",
                newName: "uni_users_identity_user_id");

            migrationBuilder.RenameIndex(
                name: "players_id_key",
                table: "users",
                newName: "users_id_key");

            migrationBuilder.RenameIndex(
                name: "idx_players_deleted_at",
                table: "users",
                newName: "idx_users_deleted_at");

            migrationBuilder.RenameColumn(
                name: "player_two_id",
                table: "teams",
                newName: "user_two_id");

            migrationBuilder.RenameColumn(
                name: "player_one_id",
                table: "teams",
                newName: "user_one_id");

            migrationBuilder.RenameColumn(
                name: "PlayerId",
                table: "QueuedPlayers",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_QueuedPlayers_PlayerId",
                table: "QueuedPlayers",
                newName: "IX_QueuedPlayers_UserId");

            migrationBuilder.RenameColumn(
                name: "player_id",
                table: "player_histories",
                newName: "user_id");

            migrationBuilder.RenameColumn(
                name: "TeamTwoPlayerTwoId",
                table: "ActiveMatches",
                newName: "TeamTwoUserTwoId");

            migrationBuilder.RenameColumn(
                name: "TeamTwoPlayerOneId",
                table: "ActiveMatches",
                newName: "TeamTwoUserOneId");

            migrationBuilder.RenameColumn(
                name: "TeamOnePlayerTwoId",
                table: "ActiveMatches",
                newName: "TeamOneUserTwoId");

            migrationBuilder.RenameColumn(
                name: "TeamOnePlayerOneId",
                table: "ActiveMatches",
                newName: "TeamOneUserOneId");

            migrationBuilder.RenameIndex(
                name: "IX_ActiveMatches_TeamTwoPlayerTwoId",
                table: "ActiveMatches",
                newName: "IX_ActiveMatches_TeamTwoUserTwoId");

            migrationBuilder.RenameIndex(
                name: "IX_ActiveMatches_TeamTwoPlayerOneId",
                table: "ActiveMatches",
                newName: "IX_ActiveMatches_TeamTwoUserOneId");

            migrationBuilder.RenameIndex(
                name: "IX_ActiveMatches_TeamOnePlayerTwoId",
                table: "ActiveMatches",
                newName: "IX_ActiveMatches_TeamOneUserTwoId");

            migrationBuilder.RenameIndex(
                name: "IX_ActiveMatches_TeamOnePlayerOneId",
                table: "ActiveMatches",
                newName: "IX_ActiveMatches_TeamOneUserOneId");

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_users_TeamOneUserOneId",
                table: "ActiveMatches",
                column: "TeamOneUserOneId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_users_TeamOneUserTwoId",
                table: "ActiveMatches",
                column: "TeamOneUserTwoId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_users_TeamTwoUserOneId",
                table: "ActiveMatches",
                column: "TeamTwoUserOneId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ActiveMatches_users_TeamTwoUserTwoId",
                table: "ActiveMatches",
                column: "TeamTwoUserTwoId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_player_histories_user",
                table: "player_histories",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_QueuedPlayers_users_UserId",
                table: "QueuedPlayers",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_teams_user_one",
                table: "teams",
                column: "user_one_id",
                principalTable: "users",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_teams_user_two",
                table: "teams",
                column: "user_two_id",
                principalTable: "users",
                principalColumn: "id");
        }
    }
}
