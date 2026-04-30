using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Players;

[Collection("Database")]
public class PlayerNameFallbackTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GetMe_FallsBackToUserDisplayName_WhenMembershipHasNoOverride()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);

        await SeedTestUser(org.Id, league.Id, "user-with-name", "named@test.com",
            displayName: "My Display Name", username: "my_username");

        AuthenticateAs("user-with-name");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/players/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var player = await ReadJsonAsync<LeaguePlayerResponse>(response);
        Assert.NotNull(player);

        Assert.Equal("My Display Name", player.DisplayName);
        Assert.Equal("my_username", player.Username);
    }
}
