using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.MatchMaking;

[Collection("Database")]
public class ActiveMatchUniqueConstraintTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task DuplicateActiveMatch_ForSamePendingMatch_ShouldBeRejectedByDatabase()
    {
        // Arrange
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);

        var pendingMatch = new V3PendingMatch
        {
            OrganizationId = org.Id,
            LeagueId = league.Id,
            Status = AcceptanceStatus.Accepted,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
        };

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            dbContext.V3PendingMatches.Add(pendingMatch);
            await dbContext.SaveChangesAsync();
        }

        // Act: insert two active matches pointing to the same pending match
        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

            var activeMatch1 = new V3ActiveMatch
            {
                OrganizationId = org.Id,
                LeagueId = league.Id,
                PendingMatchId = pendingMatch.Id,
                StartedAt = DateTimeOffset.UtcNow,
            };
            dbContext.Set<V3ActiveMatch>().Add(activeMatch1);
            await dbContext.SaveChangesAsync();

            var activeMatch2 = new V3ActiveMatch
            {
                OrganizationId = org.Id,
                LeagueId = league.Id,
                PendingMatchId = pendingMatch.Id,
                StartedAt = DateTimeOffset.UtcNow,
            };
            dbContext.Set<V3ActiveMatch>().Add(activeMatch2);

            // Assert: the second insert should fail with a unique constraint violation
            await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        }
    }
}
