using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameLeagueQueueSizeToTeamSize : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Abort if any existing league had an odd queue_size — integer division
            // below would silently round it down and shift the league's format.
            migrationBuilder.Sql(@"
                DO $$
                DECLARE
                    odd_count int;
                BEGIN
                    SELECT count(*) INTO odd_count FROM leagues WHERE queue_size % 2 <> 0;
                    IF odd_count > 0 THEN
                        RAISE EXCEPTION 'Cannot migrate: % league(s) have an odd queue_size; halving would truncate. Fix the data first.', odd_count;
                    END IF;
                END $$;
            ");

            migrationBuilder.RenameColumn(
                name: "queue_size",
                table: "leagues",
                newName: "team_size");

            // queue_size was 2 * team_size (always two teams of equal size);
            // halve the existing values so the column now stores the per-team size.
            migrationBuilder.Sql("UPDATE leagues SET team_size = team_size / 2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "team_size",
                table: "leagues",
                newName: "queue_size");

            migrationBuilder.Sql("UPDATE leagues SET queue_size = queue_size * 2");
        }
    }
}
