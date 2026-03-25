using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Leaderboard;

[Collection("Database")]
public class LeaderboardNameFallbackTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task Leaderboard_FallsBackToUserDisplayName_WhenMembershipHasNoOverride()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);

        await SeedTestUser(org.Id, league.Id, "user-with-name", "named@test.com",
            displayName: "User Display Name", username: "user_username");

        AuthenticateAs("user-with-name");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var leaderboard = await ReadJsonAsync<LeaderboardResponse>(response);
        Assert.NotNull(leaderboard);
        Assert.Single(leaderboard.Entries);

        var entry = leaderboard.Entries[0];
        Assert.Equal("User Display Name", entry.DisplayName);
        Assert.Equal("user_username", entry.Username);
    }
}
