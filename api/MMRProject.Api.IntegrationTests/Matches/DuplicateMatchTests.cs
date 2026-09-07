using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Matches;

[Collection("Database")]
public class DuplicateMatchTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    private sealed record Setup(Organization Org, League League, Guid P1, Guid P2, Guid P3, Guid P4);

    private async Task<Setup> SeedLeagueWithFourPlayers(string slug = "test-league")
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, slug: slug, name: slug);
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com", OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");
        return new Setup(org, league, p1.Id, p2.Id, p3.Id, p4.Id);
    }

    private static SubmitMatchRequest Request((Guid, Guid) team1, int score1, (Guid, Guid) team2, int score2) => new()
    {
        Teams =
        [
            new SubmitMatchTeamRequest { Players = [team1.Item1, team1.Item2], Score = score1 },
            new SubmitMatchTeamRequest { Players = [team2.Item1, team2.Item2], Score = score2 },
        ]
    };

    private Task<HttpResponseMessage> Submit(Setup s, SubmitMatchRequest request) =>
        Client.PostAsJsonAsync($"api/v3/organizations/{s.Org.Id}/leagues/{s.League.Id}/matches", request);

    private async Task<int> CountMatches(Guid leagueId)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        return await db.V3Matches.CountAsync(m => m.LeagueId == leagueId);
    }

    [Fact]
    public async Task SubmitMatch_IdenticalWithinTenMinutes_ReturnsConflict()
    {
        var s = await SeedLeagueWithFourPlayers();
        var request = Request((s.P1, s.P2), 10, (s.P3, s.P4), 5);

        var first = await Submit(s, request);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await Submit(s, request);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(1, await CountMatches(s.League.Id));
    }

    [Fact]
    public async Task SubmitMatch_ConcurrentIdenticalSubmissions_OnlyOneIsCreated()
    {
        var s = await SeedLeagueWithFourPlayers();
        var request = Request((s.P1, s.P2), 10, (s.P3, s.P4), 5);

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Submit(s, request)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(4, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, await CountMatches(s.League.Id));
    }

    [Fact]
    public async Task SubmitMatch_ConcurrentIdenticalSubmissions_WithUnenrolledMembers_OnlyOneIsCreated()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        // Members of the org but not yet players in the league: each submission
        // would enrol them, so the guard must lock before resolving players.
        var (_, m1) = await SeedOrgMember(org.Id, "p1", "p1@test.com", OrganizationRole.Owner);
        var (_, m2) = await SeedOrgMember(org.Id, "p2", "p2@test.com");
        var (_, m3) = await SeedOrgMember(org.Id, "p3", "p3@test.com");
        var (_, m4) = await SeedOrgMember(org.Id, "p4", "p4@test.com");
        AuthenticateAs("p1");

        var request = new SubmitMatchRequest
        {
            Teams =
            [
                new SubmitMatchTeamRequest
                {
                    Players =
                    [
                        new SubmitMatchPlayerRequest { OrganizationMembershipId = m1.Id },
                        new SubmitMatchPlayerRequest { OrganizationMembershipId = m2.Id },
                    ],
                    Score = 10
                },
                new SubmitMatchTeamRequest
                {
                    Players =
                    [
                        new SubmitMatchPlayerRequest { OrganizationMembershipId = m3.Id },
                        new SubmitMatchPlayerRequest { OrganizationMembershipId = m4.Id },
                    ],
                    Score = 5
                },
            ]
        };

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ =>
            Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches", request)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(4, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, await CountMatches(league.Id));
    }

    [Fact]
    public async Task SubmitMatch_SameMatchWithTeamsSwapped_ReturnsConflict()
    {
        var s = await SeedLeagueWithFourPlayers();

        var first = await Submit(s, Request((s.P1, s.P2), 10, (s.P3, s.P4), 5));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await Submit(s, Request((s.P3, s.P4), 5, (s.P1, s.P2), 10));
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(1, await CountMatches(s.League.Id));
    }

    [Fact]
    public async Task SubmitMatch_SameMatchWithPlayersReorderedWithinTeams_ReturnsConflict()
    {
        var s = await SeedLeagueWithFourPlayers();

        var first = await Submit(s, Request((s.P1, s.P2), 10, (s.P3, s.P4), 5));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await Submit(s, Request((s.P4, s.P3), 5, (s.P2, s.P1), 10));
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(1, await CountMatches(s.League.Id));
    }

    [Fact]
    public async Task SubmitMatch_SamePlayersDifferentScore_IsAccepted()
    {
        var s = await SeedLeagueWithFourPlayers();

        var first = await Submit(s, Request((s.P1, s.P2), 10, (s.P3, s.P4), 5));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await Submit(s, Request((s.P1, s.P2), 10, (s.P3, s.P4), 7));
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(2, await CountMatches(s.League.Id));
    }

    [Fact]
    public async Task SubmitMatch_SamePlayersDifferentTeamComposition_IsAccepted()
    {
        var s = await SeedLeagueWithFourPlayers();

        var first = await Submit(s, Request((s.P1, s.P2), 10, (s.P3, s.P4), 5));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await Submit(s, Request((s.P1, s.P3), 10, (s.P2, s.P4), 5));
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(2, await CountMatches(s.League.Id));
    }

    [Fact]
    public async Task SubmitMatch_IdenticalAfterTenMinutes_IsAccepted()
    {
        var s = await SeedLeagueWithFourPlayers();
        var request = Request((s.P1, s.P2), 10, (s.P3, s.P4), 5);

        var first = await Submit(s, request);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            await db.V3Matches
                .Where(m => m.LeagueId == s.League.Id)
                .ExecuteUpdateAsync(u => u.SetProperty(m => m.RecordedAt, DateTimeOffset.UtcNow.AddMinutes(-11)));
        }

        var second = await Submit(s, request);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(2, await CountMatches(s.League.Id));
    }

    [Fact]
    public async Task SubmitMatch_IdenticalInAnotherLeague_IsAccepted()
    {
        var s = await SeedLeagueWithFourPlayers();
        var otherLeague = await CreateLeague(s.Org.Id, name: "Other", slug: "other-league");
        await CreateSeason(s.Org.Id, otherLeague.Id);

        var first = await Submit(s, Request((s.P1, s.P2), 10, (s.P3, s.P4), 5));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        // Players are org members, so the other league auto-enrols them via membership ids.
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var membershipByPlayer = await db.LeaguePlayers
            .Where(lp => lp.LeagueId == s.League.Id)
            .ToDictionaryAsync(lp => lp.Id, lp => lp.OrganizationMembershipId);

        var second = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{s.Org.Id}/leagues/{otherLeague.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest
                    {
                        Players =
                        [
                            new SubmitMatchPlayerRequest { OrganizationMembershipId = membershipByPlayer[s.P1] },
                            new SubmitMatchPlayerRequest { OrganizationMembershipId = membershipByPlayer[s.P2] },
                        ],
                        Score = 10
                    },
                    new SubmitMatchTeamRequest
                    {
                        Players =
                        [
                            new SubmitMatchPlayerRequest { OrganizationMembershipId = membershipByPlayer[s.P3] },
                            new SubmitMatchPlayerRequest { OrganizationMembershipId = membershipByPlayer[s.P4] },
                        ],
                        Score = 5
                    },
                ]
            });
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
    }
}
