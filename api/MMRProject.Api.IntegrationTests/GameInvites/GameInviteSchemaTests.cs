using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.IntegrationTests.Fixtures;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.IntegrationTests.GameInvites;

[Collection("Database")]
public class GameInviteSchemaTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task Model_HasNoChangesMissingFromMigrations()
    {
        await Factory.EnsureMigratedAsync();

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        Assert.False(dbContext.Database.HasPendingModelChanges());
    }

    [Fact]
    public void FisherYates_DrawsFromShrinkingRange_AndKeepsEveryItem()
    {
        var bounds = new List<int>();

        var shuffled = GameInviteShuffle.FisherYates(
            new[] { 0, 1, 2, 3, 4 },
            upperExclusive =>
            {
                bounds.Add(upperExclusive);
                return 0;
            });

        // Each position i is swapped with a draw from [0, i], so every position is drawn exactly once.
        Assert.Equal(new[] { 5, 4, 3, 2 }, bounds);
        Assert.Equal(new[] { 0, 1, 2, 3, 4 }, shuffled.OrderBy(x => x));
    }
}
