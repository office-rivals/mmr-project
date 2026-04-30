using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Players;

[Collection("Database")]
public class LeaguePlayerTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task JoinLeague_CreatesPlayerWithDefaultMmr()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await SeedOrgMember(org.Id, "player-1", "player@test.com");
        AuthenticateAs("player-1");

        var response = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/players", null);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var player = await ReadJsonAsync<LeaguePlayerResponse>(response);
        Assert.NotNull(player);
        Assert.True(player.Mmr > 0);
    }

    [Fact]
    public async Task JoinLeague_Duplicate_Fails()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await SeedOrgMember(org.Id, "player-1", "player@test.com");
        AuthenticateAs("player-1");

        var first = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/players", null);
        first.EnsureSuccessStatusCode();

        var second = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/players", null);

        Assert.True(second.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task GetPlayer_ReturnsCorrectData()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var (_, _, seededPlayer) = await SeedTestUser(org.Id, league.Id, "player-1", "player@test.com");
        AuthenticateAs("player-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/players/{seededPlayer.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var player = await ReadJsonAsync<LeaguePlayerResponse>(response);
        Assert.NotNull(player);
        Assert.Equal(seededPlayer.Id, player.Id);
    }

    [Fact]
    public async Task GetMe_ReturnsCurrentUsersPlayer()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var (_, _, seededPlayer) = await SeedTestUser(org.Id, league.Id, "player-1", "player@test.com");
        AuthenticateAs("player-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/players/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var player = await ReadJsonAsync<LeaguePlayerResponse>(response);
        Assert.NotNull(player);
        Assert.Equal(seededPlayer.Id, player.Id);
    }
}
