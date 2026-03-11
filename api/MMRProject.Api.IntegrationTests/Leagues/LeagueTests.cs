using System.Net;
using System.Net.Http.Json;
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
            new CreateLeagueRequest { Name = "Foosball", Slug = "foosball", QueueSize = 4 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var league = await response.Content.ReadFromJsonAsync<LeagueResponse>();
        Assert.NotNull(league);
        Assert.Equal("Foosball", league.Name);
        Assert.Equal("foosball", league.Slug);
        Assert.Equal(4, league.QueueSize);
    }

    [Fact]
    public async Task CreateLeague_DuplicateSlugInSameOrg_Fails()
    {
        var org = await CreateOrganization("Dup Org", "dup-org");
        await CreateLeague(org.Id, "First League", "first-league");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Second League", Slug = "first-league" });

        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict);
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
        var leagues = await response.Content.ReadFromJsonAsync<List<LeagueResponse>>();
        Assert.NotNull(leagues);
        Assert.Equal(2, leagues.Count);
        Assert.All(leagues, l => Assert.Equal(org1.Id, l.OrganizationId));
    }
}
