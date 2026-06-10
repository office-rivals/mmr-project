using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Leagues;

[Collection("Database")]
public class LeagueTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task CreateLeague_Succeeds()
    {
        var org = await CreateOrganization("League Org", "league-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Foosball", Slug = "foosball", TeamSize = 2 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var league = await ReadJsonAsync<LeagueResponse>(response);
        Assert.NotNull(league);
        Assert.Equal("Foosball", league.Name);
        Assert.Equal("foosball", league.Slug);
        Assert.Equal(2, league.TeamSize);
    }

    [Fact]
    public async Task CreateLeague_DuplicateSlugInSameOrg_Fails()
    {
        var org = await CreateOrganization("Dup Org", "dup-org");
        await CreateLeague(org.Id, "First League", "first-league");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Second League", Slug = "first-league", TeamSize = 2 });

        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task UpdateLeague_SetWinningScore_Persists()
    {
        var org = await CreateOrganization("Update Org", "update-org");
        var league = await CreateLeague(org.Id, winningScore: 10);
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}",
            new UpdateLeagueRequest { UpdateWinningScore = true, WinningScore = 21 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync<LeagueResponse>(response);
        Assert.NotNull(body);
        Assert.Equal(21, body.WinningScore);
    }

    [Fact]
    public async Task UpdateLeague_ClearWinningScore_SwitchesToFreeForm()
    {
        var org = await CreateOrganization("Clear Org", "clear-org");
        var league = await CreateLeague(org.Id, winningScore: 10);
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}",
            new UpdateLeagueRequest { UpdateWinningScore = true, WinningScore = null });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync<LeagueResponse>(response);
        Assert.NotNull(body);
        Assert.Null(body.WinningScore);
    }

    [Fact]
    public async Task UpdateLeague_WithoutUpdateFlag_LeavesWinningScoreUntouched()
    {
        var org = await CreateOrganization("Untouched Org", "untouched-org");
        var league = await CreateLeague(org.Id, winningScore: 10);
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        // WinningScore null + flag false must be a no-op for the score, not a clear.
        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}",
            new UpdateLeagueRequest { Name = "Renamed League" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync<LeagueResponse>(response);
        Assert.NotNull(body);
        Assert.Equal("Renamed League", body.Name);
        Assert.Equal(10, body.WinningScore);
    }

    [Fact]
    public async Task UpdateLeague_WithInvalidWinningScore_Fails()
    {
        var org = await CreateOrganization("Invalid Org", "invalid-org");
        var league = await CreateLeague(org.Id, winningScore: 10);
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}",
            new UpdateLeagueRequest { UpdateWinningScore = true, WinningScore = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ListLeagues_ReturnsOnlyOrgLeagues()
    {
        var org1 = await CreateOrganization("Org One", "org-one");
        var org2 = await CreateOrganization("Org Two", "org-two");
        await CreateLeague(org1.Id, "League A", "league-a");
        await CreateLeague(org1.Id, "League B", "league-b");
        await CreateLeague(org2.Id, "League C", "league-c");

        await SeedOrgMember(org1.Id, "member-1", "member@test.com");
        AuthenticateAs("member-1");

        var response = await Client.GetAsync($"api/v3/organizations/{org1.Id}/leagues");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var leagues = await ReadJsonAsync<List<LeagueResponse>>(response);
        Assert.NotNull(leagues);
        Assert.Equal(2, leagues.Count);
        Assert.All(leagues, l => Assert.Equal(org1.Id, l.OrganizationId));
    }
}
