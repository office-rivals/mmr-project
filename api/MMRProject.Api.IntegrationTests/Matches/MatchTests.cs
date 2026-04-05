using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Matches;

[Collection("Database")]
public class MatchTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task SubmitMatch_CreatesTeamsAndRatingHistory()
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

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest
                        { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest
                        { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var match = await ReadJsonAsync<MatchResponse>(response);
        Assert.NotNull(match);
        Assert.Equal(2, match.Teams.Count);
        Assert.Equal(MatchSource.Manual, match.Source);

        var winnerTeam = match.Teams.First(t => t.Score == 10);
        Assert.True(winnerTeam.IsWinner);
    }

    [Fact]
    public async Task GetMatches_ReturnsLeagueScopedResults()
    {
        var org = await CreateOrganization();
        var league1 = await CreateLeague(org.Id, "League 1", "league-1");
        var league2 = await CreateLeague(org.Id, "League 2", "league-2");
        await CreateSeason(org.Id, league1.Id);
        await CreateSeason(org.Id, league2.Id);

        var (_, _, p1L1) = await SeedTestUser(org.Id, league1.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, p2L1) = await SeedTestUser(org.Id, league1.Id, "p2", "p2@test.com");
        var (_, _, p3L1) = await SeedTestUser(org.Id, league1.Id, "p3", "p3@test.com");
        var (_, _, p4L1) = await SeedTestUser(org.Id, league1.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1L1.Id, p2L1.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3L1.Id, p4L1.Id], Score = 5 }
                ]
            });

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/matches");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var matches = await ReadJsonAsync<List<MatchResponse>>(response);
        Assert.NotNull(matches);
        Assert.Single(matches);
        Assert.Equal(league1.Id, matches[0].LeagueId);

        var emptyResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league2.Id}/matches");
        var emptyMatches = await ReadJsonAsync<List<MatchResponse>>(emptyResponse);
        Assert.NotNull(emptyMatches);
        Assert.Empty(emptyMatches);
    }

    [Fact]
    public async Task DeleteMatch_AsModerator_Succeeds()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Moderator);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        var submitResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });
        submitResponse.EnsureSuccessStatusCode();
        var match = await ReadJsonAsync<MatchResponse>(submitResponse);

        var deleteResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{match!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{match.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteMatch_MostRecentMatch_RestoresPreviousRatings()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Moderator);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        var firstMatchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });
        firstMatchResponse.EnsureSuccessStatusCode();

        var secondMatchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 5 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 10 }
                ]
            });
        secondMatchResponse.EnsureSuccessStatusCode();
        var secondMatch = await ReadJsonAsync<MatchResponse>(secondMatchResponse);

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            var playerBeforeDelete = await dbContext.LeaguePlayers.FindAsync(player1.Id);
            Assert.NotNull(playerBeforeDelete);
            Assert.Equal(1000, playerBeforeDelete.Mmr);
        }

        var deleteResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{secondMatch!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            var restoredPlayer = await dbContext.LeaguePlayers.FindAsync(player1.Id);
            Assert.NotNull(restoredPlayer);
            Assert.Equal(1025, restoredPlayer.Mmr);
        }
    }

    [Fact]
    public async Task DeleteMatch_OlderMatch_IsRejected()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Moderator);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        var firstMatchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });
        firstMatchResponse.EnsureSuccessStatusCode();
        var firstMatch = await ReadJsonAsync<MatchResponse>(firstMatchResponse);

        var secondMatchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 5 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 10 }
                ]
            });
        secondMatchResponse.EnsureSuccessStatusCode();

        var deleteResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{firstMatch!.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task GetSingleMatch_ReturnsCorrectData()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var season = await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        var submitResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });
        var created = await ReadJsonAsync<MatchResponse>(submitResponse);

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{created!.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var match = await ReadJsonAsync<MatchResponse>(response);
        Assert.NotNull(match);
        Assert.Equal(created.Id, match.Id);
        Assert.Equal(league.Id, match.LeagueId);
        Assert.Equal(season.Id, match.SeasonId);
        Assert.Equal(MatchSource.Manual, match.Source);
        Assert.Equal(2, match.Teams.Count);
        Assert.All(match.Teams, t => Assert.Equal(2, t.Players.Count));
    }

    [Fact]
    public async Task SubmitMatch_WithoutSeason_Fails()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        // No season created

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });

        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound,
            $"Expected 400 or 404 but got {response.StatusCode}");
    }

    [Fact]
    public async Task SubmitMatch_WithInvalidPlayers_Fails()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);

        AuthenticateAs("p1");

        var fakeId1 = Guid.NewGuid();
        var fakeId2 = Guid.NewGuid();
        var fakeId3 = Guid.NewGuid();

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, fakeId1], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [fakeId2, fakeId3], Score = 5 }
                ]
            });

        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound,
            $"Expected 400 or 404 but got {response.StatusCode}");
    }

    [Fact]
    public async Task SubmitMatch_WithOrgMemberNotInLeague_AddsThemToLeague()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, member3) = await SeedOrgMember(org.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new
            {
                teams = new object[]
                {
                    new
                    {
                        players = new object[]
                        {
                            new { leaguePlayerId = player1.Id },
                            new { leaguePlayerId = player2.Id }
                        },
                        score = 10
                    },
                    new
                    {
                        players = new object[]
                        {
                            new { organizationMembershipId = member3.Id },
                            new { leaguePlayerId = player4.Id }
                        },
                        score = 5
                    }
                }
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var addedPlayer = dbContext.LeaguePlayers.SingleOrDefault(lp =>
            lp.OrganizationId == org.Id
            && lp.LeagueId == league.Id
            && lp.OrganizationMembershipId == member3.Id);

        Assert.NotNull(addedPlayer);
    }

    [Fact]
    public async Task SubmitMatch_WithNewPlayer_CreatesProvisionalMembershipAndLeaguePlayer()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");

        AuthenticateAs("p1");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new
            {
                teams = new object[]
                {
                    new
                    {
                        players = new object[]
                        {
                            new { leaguePlayerId = player1.Id },
                            new { leaguePlayerId = player2.Id }
                        },
                        score = 10
                    },
                    new
                    {
                        players = new object[]
                        {
                            new { leaguePlayerId = player3.Id },
                            new
                            {
                                newPlayer = new
                                {
                                    displayName = "New Recruit",
                                    email = "new-recruit@test.com"
                                }
                            }
                        },
                        score = 5
                    }
                }
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var membership = dbContext.OrganizationMemberships.SingleOrDefault(m =>
            m.OrganizationId == org.Id && m.InviteEmail == "new-recruit@test.com");
        Assert.NotNull(membership);
        Assert.Equal(MembershipStatus.Invited, membership.Status);
        Assert.Equal("New Recruit", membership.DisplayName);

        var leaguePlayer = dbContext.LeaguePlayers.SingleOrDefault(lp =>
            lp.OrganizationId == org.Id
            && lp.LeagueId == league.Id
            && lp.OrganizationMembershipId == membership.Id);
        Assert.NotNull(leaguePlayer);
    }

    [Fact]
    public async Task SubmitMatch_RatingHistoryCreated()
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
    public async Task SubmitMatch_WhenMmrCalculationFails_RollsBackPersistedMatch()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        Factory.StubMmrCalculationApiClient.ThrowOnCalculate = true;
        AuthenticateAs("p1");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.False(await dbContext.V3Matches.AnyAsync());
        Assert.False(await dbContext.RatingHistories.AnyAsync());
    }

    [Fact]
    public async Task GetMatches_FilterBySeasonId()
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

        // Submit a match (lands in latest season = season2)
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

        // Filter by season2 - should have the match
        var response1 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches?seasonId={season2.Id}");
        var matches1 = await ReadJsonAsync<List<MatchResponse>>(response1);
        Assert.NotNull(matches1);
        Assert.Single(matches1);

        // Filter by season1 - should be empty
        var response2 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches?seasonId={season1.Id}");
        var matches2 = await ReadJsonAsync<List<MatchResponse>>(response2);
        Assert.NotNull(matches2);
        Assert.Empty(matches2);
    }

    [Fact]
    public async Task GetMatches_Pagination()
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

        // Submit 3 matches
        for (var i = 0; i < 3; i++)
        {
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
        }

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches?limit=2");
        var matches = await ReadJsonAsync<List<MatchResponse>>(response);
        Assert.NotNull(matches);
        Assert.Equal(2, matches.Count);
    }
}
