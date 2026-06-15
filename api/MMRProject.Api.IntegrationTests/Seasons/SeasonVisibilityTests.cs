using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Seasons;

[Collection("Database")]
public class SeasonVisibilityTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task ListSeasons_AsMember_ExcludesFutureSeasons()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com");

        var past = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-1));
        var future = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(30));

        AuthenticateAs("member-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/seasons");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var seasons = await ReadJsonAsync<List<SeasonResponse>>(response);
        Assert.NotNull(seasons);
        var only = Assert.Single(seasons);
        Assert.Equal(past.Id, only.Id);
        Assert.DoesNotContain(seasons, s => s.Id == future.Id);
    }

    [Fact]
    public async Task AdminListSeasons_AsModerator_IncludesFutureSeasons()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await SeedTestUser(org.Id, league.Id, "mod-1", "mod@test.com", OrganizationRole.Moderator);

        var past = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-1));
        var future = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(30));

        AuthenticateAs("mod-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/admin/seasons");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var seasons = await ReadJsonAsync<List<SeasonResponse>>(response);
        Assert.NotNull(seasons);
        Assert.Equal(2, seasons.Count);
        Assert.Contains(seasons, s => s.Id == future.Id);
        Assert.Contains(seasons, s => s.Id == past.Id);
    }

    [Fact]
    public async Task AdminListSeasons_AsMember_ShouldReturn403()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com");

        AuthenticateAs("member-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/admin/seasons");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
