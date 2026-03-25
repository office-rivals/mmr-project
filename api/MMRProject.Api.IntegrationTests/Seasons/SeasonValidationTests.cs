using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Seasons;

[Collection("Database")]
public class SeasonValidationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GetSeasons_ForNonExistentLeague_ShouldReturn404()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "member-1", "member@test.com");
        AuthenticateAs("member-1");

        var bogusLeagueId = Guid.NewGuid();
        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{bogusLeagueId}/seasons");

        // Currently returns 200 with empty list — should return 404
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCurrentSeason_ForNonExistentLeague_ShouldReturn404()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "member-1", "member@test.com");
        AuthenticateAs("member-1");

        var bogusLeagueId = Guid.NewGuid();
        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{bogusLeagueId}/seasons/current");

        // Currently returns 200 with null/204 — should return 404
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
