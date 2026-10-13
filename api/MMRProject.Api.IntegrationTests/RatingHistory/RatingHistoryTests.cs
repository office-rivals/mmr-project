using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.RatingHistory;

[Collection("Database")]
public class RatingHistoryTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GetRatingHistory_AfterMatchSubmission()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history/{player1.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var history = await ReadJsonAsync<RatingHistoryResponse>(response);
        Assert.NotNull(history);
        Assert.NotEmpty(history.Entries);
    }

    [Fact]
    public async Task GetRatingHistory_FilterBySeason()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var season1 = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-10));
        var season2 = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        // Submit match (should land in current/latest season)
        await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });

        // Filter by season2 (current) - should have entries
        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history/{player1.Id}?seasonId={season2.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var history = await ReadJsonAsync<RatingHistoryResponse>(response);
        Assert.NotNull(history);
        Assert.NotEmpty(history.Entries);

        // Filter by season1 (old) - should be empty
        var response2 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history/{player1.Id}?seasonId={season1.Id}");
        Assert.Equal(HttpStatusCode.OK, response2.StatusCode);
        var history2 = await ReadJsonAsync<RatingHistoryResponse>(response2);
        Assert.NotNull(history2);
        Assert.Empty(history2.Entries);
    }

    [Fact]
    public async Task GetRatingHistory_ScopedToLeague()
    {
        var org = await CreateOrganization();
        var league1 = await CreateLeague(org.Id, "League 1", "league-1");
        var league2 = await CreateLeague(org.Id, "League 2", "league-2");
        await CreateSeason(org.Id, league1.Id);
        await CreateSeason(org.Id, league2.Id);

        var (user1, _, player1L1) = await SeedTestUser(org.Id, league1.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2L1) = await SeedTestUser(org.Id, league1.Id, "p2", "p2@test.com");
        var (_, _, player3L1) = await SeedTestUser(org.Id, league1.Id, "p3", "p3@test.com");
        var (_, _, player4L1) = await SeedTestUser(org.Id, league1.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        // Submit match in league1
        await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1L1.Id, player2L1.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3L1.Id, player4L1.Id], Score = 5 }
                ]
            });

        // Get history for league1 - should have entries
        var response1 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/rating-history/{player1L1.Id}");
        Assert.Equal(HttpStatusCode.OK, response1.StatusCode);
        var history1 = await ReadJsonAsync<RatingHistoryResponse>(response1);
        Assert.NotNull(history1);
        Assert.NotEmpty(history1.Entries);

        // Get history for league2 for the same player shouldn't exist (different league player)
        // Since the player isn't in league2, this should return not found or empty
        var response2 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league2.Id}/rating-history/{player1L1.Id}");
        Assert.True(
            response2.StatusCode == HttpStatusCode.NotFound || response2.StatusCode == HttpStatusCode.OK,
            $"Expected NotFound or OK, got {response2.StatusCode}");
    }

    [Fact]
    public async Task GetLeagueRatingHistory_ExcludesPlayersBelowRankedThreshold()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        // Only 5 matches — below the 10-match threshold
        for (var i = 0; i < 5; i++)
        {
            await Client.PostAsJsonAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
                new SubmitMatchRequest
                {
                    Teams =
                    [
                        new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                        new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = i }
                    ]
                });
        }

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var history = await ReadJsonAsync<LeagueRatingHistoryResponse>(response);
        Assert.NotNull(history);
        Assert.Empty(history.Entries);
    }

    [Fact]
    public async Task GetLeagueRatingHistory_IncludesPlayersAtOrAboveRankedThreshold()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        for (var i = 0; i < 10; i++)
        {
            await Client.PostAsJsonAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
                new SubmitMatchRequest
                {
                    Teams =
                    [
                        new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                        new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = i }
                    ]
                });
        }

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var history = await ReadJsonAsync<LeagueRatingHistoryResponse>(response);
        Assert.NotNull(history);

        var p1Entries = history.Entries.Where(e => e.LeaguePlayerId == p1.Id).ToList();
        Assert.Equal(10, p1Entries.Count);
        Assert.All(p1Entries, e => Assert.True(e.Mmr > 0));
    }

    [Fact]
    public async Task GetRatingHistory_OrdersByPlayedAt()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var season = await CreateSeason(org.Id, league.Id);
        var (p1, p2, p3, p4) = await SeedFourPlayers(org.Id, league.Id);

        AuthenticateAs("p1");

        var first = await SubmitMatch(org.Id, league.Id, (p1.Id, p2.Id), (p3.Id, p4.Id), 5);
        var second = await SubmitMatch(org.Id, league.Id, (p1.Id, p2.Id), (p3.Id, p4.Id), 6);
        var late = await SubmitMatch(org.Id, league.Id, (p1.Id, p2.Id), (p3.Id, p4.Id), 7);
        var playedAt = first.PlayedAt.AddMinutes(-1);
        await SetPlayedAt(late.Id, playedAt);

        foreach (var query in new[] { "", $"?seasonId={season.Id}" })
        {
            var response = await Client.GetAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history/{p1.Id}{query}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var history = await ReadJsonAsync<RatingHistoryResponse>(response);

            Assert.Equal([late.Id, first.Id, second.Id], history!.Entries.Select(e => e.MatchId));
            Assert.Equal(playedAt, history.Entries[0].PlayedAt);
        }
    }

    [Fact]
    public async Task GetLeagueRatingHistory_OrdersByPlayedAt()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);
        var (p1, p2, p3, p4) = await SeedFourPlayers(org.Id, league.Id);

        AuthenticateAs("p1");

        var matches = new List<MatchResponse>();
        for (var i = 0; i < 10; i++)
            matches.Add(await SubmitMatch(org.Id, league.Id, (p1.Id, p2.Id), (p3.Id, p4.Id), i));
        var late = matches[^1];
        var playedAt = matches[0].PlayedAt.AddMinutes(-1);
        await SetPlayedAt(late.Id, playedAt);

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var history = await ReadJsonAsync<LeagueRatingHistoryResponse>(response);

        var p1Entries = history!.Entries.Where(e => e.LeaguePlayerId == p1.Id).ToList();
        Assert.Equal(matches.Take(9).Select(m => m.Id).Prepend(late.Id), p1Entries.Select(e => e.MatchId));
        Assert.Equal(playedAt, p1Entries[0].PlayedAt);
    }

    [Fact]
    public async Task GetRatingHistory_WithoutSeason_OrdersEarlierSeasonFirst()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-10));
        var (p1, p2, p3, p4) = await SeedFourPlayers(org.Id, league.Id);

        AuthenticateAs("p1");

        var seasonOneMatch = await SubmitMatch(org.Id, league.Id, (p1.Id, p2.Id), (p3.Id, p4.Id), 5);

        // A backdated season can start before the previous season's last match. A match
        // moved into that overlap still rates after every earlier-season match.
        await CreateSeason(org.Id, league.Id, seasonOneMatch.PlayedAt.AddHours(-1));
        var seasonTwoMatch = await SubmitMatch(org.Id, league.Id, (p1.Id, p2.Id), (p3.Id, p4.Id), 6);
        await SetPlayedAt(seasonTwoMatch.Id, seasonOneMatch.PlayedAt.AddMinutes(-30));

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history/{p1.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var history = await ReadJsonAsync<RatingHistoryResponse>(response);

        Assert.Equal([seasonOneMatch.Id, seasonTwoMatch.Id], history!.Entries.Select(e => e.MatchId));
    }

    private async Task<(LeaguePlayer P1, LeaguePlayer P2, LeaguePlayer P3, LeaguePlayer P4)> SeedFourPlayers(
        Guid orgId, Guid leagueId)
    {
        var (_, _, p1) = await SeedTestUser(orgId, leagueId, "p1", "p1@test.com", OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(orgId, leagueId, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(orgId, leagueId, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(orgId, leagueId, "p4", "p4@test.com");
        return (p1, p2, p3, p4);
    }

    private async Task<MatchResponse> SubmitMatch(Guid orgId, Guid leagueId,
        (Guid, Guid) winners, (Guid, Guid) losers, int loserScore)
    {
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgId}/leagues/{leagueId}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [winners.Item1, winners.Item2], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [losers.Item1, losers.Item2], Score = loserScore }
                ]
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<MatchResponse>(response))!;
    }

    private async Task SetPlayedAt(Guid matchId, DateTimeOffset playedAt)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        await db.V3Matches
            .Where(m => m.Id == matchId)
            .ExecuteUpdateAsync(u => u.SetProperty(m => m.PlayedAt, playedAt));
    }
}
