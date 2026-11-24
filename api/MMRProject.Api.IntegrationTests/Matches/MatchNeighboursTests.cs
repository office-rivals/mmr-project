using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Matches;

[Collection("Database")]
public class MatchNeighboursTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    private static readonly DateTimeOffset Noon = new(2026, 10, 30, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task GetMatchNeighbours_ReturnsNearestEarlierAndLaterMatchInTheLeague()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var oldSeason = await CreateSeason(org.Id, league.Id, Noon.AddDays(-30));
        await CreateSeason(org.Id, league.Id, Noon.AddDays(-1));
        var players = await SeedPlayers(org.Id, league.Id);
        AuthenticateAs("p1");

        // Submitted out of time order: neighbours follow played time, not insertion.
        var target = await Submit(org.Id, league.Id, players, 10, 3);
        var later = await Submit(org.Id, league.Id, players, 10, 4);
        var earlier = await Submit(org.Id, league.Id, players, 10, 2);
        var earliest = await Submit(org.Id, league.Id, players, 10, 1);
        var farLater = await Submit(org.Id, league.Id, players, 10, 5);

        // A match in another league, closer in time than either neighbour.
        var otherLeague = await CreateLeague(org.Id, "Other League", "other-league", teamSize: 1);
        await CreateSeason(org.Id, otherLeague.Id, Noon.AddDays(-1));
        var (_, _, q1) = await SeedTestUser(org.Id, otherLeague.Id, "q1", "q1@test.com");
        var (_, _, q2) = await SeedTestUser(org.Id, otherLeague.Id, "q2", "q2@test.com");
        var otherResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{otherLeague.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [q1.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [q2.Id], Score = 0 }
                ]
            });
        otherResponse.EnsureSuccessStatusCode();
        var other = await ReadJsonAsync<MatchResponse>(otherResponse);

        await SetPlayedAt(earliest.Id, Noon.AddDays(-20), oldSeason.Id);
        await SetPlayedAt(earlier.Id, Noon.AddMinutes(-4));
        await SetPlayedAt(target.Id, Noon);
        await SetPlayedAt(later.Id, Noon.AddMinutes(105));
        await SetPlayedAt(farLater.Id, Noon.AddHours(5));
        await SetPlayedAt(other!.Id, Noon.AddMinutes(1));

        var neighbours = await GetNeighbours(org.Id, league.Id, target.Id);
        Assert.Equal(earlier.Id, neighbours.Before?.Id);
        Assert.Equal(later.Id, neighbours.After?.Id);
        Assert.Equal(2, neighbours.Before!.Teams.Count);

        // The nearest earlier match may be in a past season.
        var aroundEarlier = await GetNeighbours(org.Id, league.Id, earlier.Id);
        Assert.Equal(earliest.Id, aroundEarlier.Before?.Id);
        Assert.Equal(target.Id, aroundEarlier.After?.Id);

        var aroundFirst = await GetNeighbours(org.Id, league.Id, earliest.Id);
        Assert.Null(aroundFirst.Before);
        Assert.Equal(earlier.Id, aroundFirst.After?.Id);

        var aroundLast = await GetNeighbours(org.Id, league.Id, farLater.Id);
        Assert.Equal(later.Id, aroundLast.Before?.Id);
        Assert.Null(aroundLast.After);
    }

    [Fact]
    public async Task GetMatchNeighbours_SamePlayedAt_OrdersByRecordedAt()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id, Noon.AddDays(-1));
        var players = await SeedPlayers(org.Id, league.Id);
        AuthenticateAs("p1");

        var first = await Submit(org.Id, league.Id, players, 10, 1);
        var second = await Submit(org.Id, league.Id, players, 10, 2);
        var third = await Submit(org.Id, league.Id, players, 10, 3);
        foreach (var match in new[] { first, second, third })
            await SetPlayedAt(match.Id, Noon);

        var neighbours = await GetNeighbours(org.Id, league.Id, second.Id);
        Assert.Equal(first.Id, neighbours.Before?.Id);
        Assert.Equal(third.Id, neighbours.After?.Id);
    }

    [Fact]
    public async Task GetMatchNeighbours_UnknownMatch_ReturnsNotFound()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);
        await SeedPlayers(org.Id, league.Id);
        AuthenticateAs("p1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{Guid.NewGuid()}/neighbours");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<LeaguePlayer[]> SeedPlayers(Guid orgId, Guid leagueId)
    {
        var (_, _, p1) = await SeedTestUser(orgId, leagueId, "p1", "p1@test.com", OrganizationRole.Moderator);
        var (_, _, p2) = await SeedTestUser(orgId, leagueId, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(orgId, leagueId, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(orgId, leagueId, "p4", "p4@test.com");
        return [p1, p2, p3, p4];
    }

    // Distinct losing scores keep the duplicate-submission guard out of the way.
    private async Task<MatchResponse> Submit(Guid orgId, Guid leagueId, LeaguePlayer[] p, int winner, int loser)
    {
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgId}/leagues/{leagueId}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p[0].Id, p[1].Id], Score = winner },
                    new SubmitMatchTeamRequest { Players = [p[2].Id, p[3].Id], Score = loser }
                ]
            });
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<MatchResponse>(response))!;
    }

    private async Task SetPlayedAt(Guid matchId, DateTimeOffset playedAt, Guid? seasonId = null)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var match = await dbContext.V3Matches.FirstAsync(m => m.Id == matchId);
        match.PlayedAt = playedAt;
        if (seasonId is { } season) match.SeasonId = season;
        await dbContext.SaveChangesAsync();
    }

    private async Task<MatchNeighboursResponse> GetNeighbours(Guid orgId, Guid leagueId, Guid matchId)
    {
        var response = await Client.GetAsync(
            $"api/v3/organizations/{orgId}/leagues/{leagueId}/matches/{matchId}/neighbours");
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<MatchNeighboursResponse>(response))!;
    }
}
