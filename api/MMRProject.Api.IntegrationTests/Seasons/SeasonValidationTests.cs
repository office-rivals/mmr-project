using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Seasons;

[Collection("Database")]
public class SeasonValidationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    // For Members the LeagueAccess auth handler returns the same 403 whether
    // the league doesn't exist or it exists but the user isn't in it. This is
    // intentional: it prevents a non-member from enumerating which leagues
    // exist in an org via response-code probing.
    [Fact]
    public async Task GetSeasons_ForNonExistentLeague_AsMember_ShouldReturn403()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "member-1", "member@test.com");
        AuthenticateAs("member-1");

        var bogusLeagueId = Guid.NewGuid();
        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{bogusLeagueId}/seasons");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetCurrentSeason_ForNonExistentLeague_AsMember_ShouldReturn403()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "member-1", "member@test.com");
        AuthenticateAs("member-1");

        var bogusLeagueId = Guid.NewGuid();
        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{bogusLeagueId}/seasons/current");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetSeasons_ForExistingLeagueButNonMember_AsMember_ShouldReturn403()
    {
        // Confirms the 403 above isn't a "league missing" leak: a Member who
        // is in the org but not in the league gets the same response shape.
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await SeedOrgMember(org.Id, "member-1", "member@test.com");
        AuthenticateAs("member-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/seasons");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
