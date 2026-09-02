using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.MatchMaking;

[Collection("Database")]
public class RfidTeamAssignmentTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GenerateRfidTeamAssignment_ReturnsMmrBalancedTeamsInInputOrder()
    {
        var organization = await CreateOrganization();
        var league = await CreateLeague(organization.Id, teamSize: 2);
        var player1 = await SeedTestUser(organization.Id, league.Id, "p1", "p1@test.com");
        var player2 = await SeedTestUser(organization.Id, league.Id, "p2", "p2@test.com");
        var player3 = await SeedTestUser(organization.Id, league.Id, "p3", "p3@test.com");
        var player4 = await SeedTestUser(organization.Id, league.Id, "p4", "p4@test.com");

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            var leaguePlayers = await dbContext
                .LeaguePlayers.Where(lp =>
                    lp.Id == player1.LeaguePlayer.Id
                    || lp.Id == player2.LeaguePlayer.Id
                    || lp.Id == player3.LeaguePlayer.Id
                    || lp.Id == player4.LeaguePlayer.Id
                )
                .ToListAsync();

            leaguePlayers.Single(lp => lp.Id == player1.LeaguePlayer.Id).Mmr = 2000;
            leaguePlayers.Single(lp => lp.Id == player2.LeaguePlayer.Id).Mmr = 1700;
            leaguePlayers.Single(lp => lp.Id == player3.LeaguePlayer.Id).Mmr = 1000;
            leaguePlayers.Single(lp => lp.Id == player4.LeaguePlayer.Id).Mmr = 800;

            dbContext.RfidTags.AddRange(
                new RfidTag { UserId = player1.User.Id, RfidUid = "A" },
                new RfidTag { UserId = player2.User.Id, RfidUid = "B" },
                new RfidTag { UserId = player3.User.Id, RfidUid = "C" },
                new RfidTag { UserId = player4.User.Id, RfidUid = "D" }
            );
            await dbContext.SaveChangesAsync();
        }

        AuthenticateAs("p1");
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/matchmaking/rfid",
            new { rfidUids = new[] { "A", "B", "C", "D" }, temperature = 0d }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal([0, 1, 1, 0], await ReadJsonAsync<List<int>>(response));

        AuthenticateAsPat("p1", "write", organization.Id, league.Id);
        var patResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/matchmaking/rfid",
            new { rfidUids = new[] { "A", "B", "C", "D" } }
        );

        Assert.Equal(HttpStatusCode.OK, patResponse.StatusCode);
        Assert.Equal([0, 1, 1, 0], await ReadJsonAsync<List<int>>(patResponse));
    }

    [Fact]
    public async Task GenerateRfidTeamAssignment_UnknownRfid_ReturnsNotFound()
    {
        var organization = await CreateOrganization();
        var league = await CreateLeague(organization.Id, teamSize: 2);
        await SeedTestUser(organization.Id, league.Id, "p1", "p1@test.com");

        AuthenticateAs("p1");
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/matchmaking/rfid",
            new { rfidUids = new[] { "A", "B", "C", "D" } }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GenerateRfidTeamAssignment_WrongRfidCount_ReturnsBadRequest()
    {
        var organization = await CreateOrganization();
        var league = await CreateLeague(organization.Id, teamSize: 2);
        await SeedTestUser(organization.Id, league.Id, "p1", "p1@test.com");

        AuthenticateAs("p1");
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/matchmaking/rfid",
            new { rfidUids = new[] { "A", "B", "C" } }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(1.1)]
    public async Task GenerateRfidTeamAssignment_InvalidTemperature_ReturnsBadRequest(
        double temperature
    )
    {
        var organization = await CreateOrganization();
        var league = await CreateLeague(organization.Id, teamSize: 2);
        await SeedTestUser(organization.Id, league.Id, "p1", "p1@test.com");

        AuthenticateAs("p1");
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/matchmaking/rfid",
            new { rfidUids = new[] { "A", "B", "C", "D" }, temperature }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GenerateRfidTeamAssignment_RfidOwnerOutsideLeague_ReturnsNotFound()
    {
        var organization = await CreateOrganization();
        var league = await CreateLeague(organization.Id, teamSize: 1);
        var player = await SeedTestUser(organization.Id, league.Id, "p1", "p1@test.com");
        var outsider = await SeedOrgMember(organization.Id, "outsider", "outsider@test.com");

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            dbContext.RfidTags.AddRange(
                new RfidTag { UserId = player.User.Id, RfidUid = "A" },
                new RfidTag { UserId = outsider.User.Id, RfidUid = "B" }
            );
            await dbContext.SaveChangesAsync();
        }

        AuthenticateAs("p1");
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/matchmaking/rfid",
            new { rfidUids = new[] { "A", "B" } }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
