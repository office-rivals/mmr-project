using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Seasons;

[Collection("Database")]
public class SeasonTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task CreateSeason_Succeeds()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "owner-1", "owner@test.com",
            OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var startsAt = DateTimeOffset.UtcNow.AddDays(-1);
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/seasons",
            new CreateSeasonRequest { StartsAt = startsAt });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var season = await ReadJsonAsync<SeasonResponse>(response);
        Assert.NotNull(season);
        Assert.Equal(league.Id, season.LeagueId);
    }

    [Fact]
    public async Task GetCurrentSeason_ReturnsLatest()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com");

        var older = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-30));
        var newer = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-1));

        AuthenticateAs("member-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/seasons/current");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var current = await ReadJsonAsync<SeasonResponse>(response);
        Assert.NotNull(current);
        Assert.Equal(newer.Id, current.Id);
    }
}
