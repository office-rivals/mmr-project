using System.Net;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Leaderboard;

[Collection("Database")]
public class LeaderboardNameFallbackTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task Leaderboard_FallsBackToUserDisplayName_WhenMembershipHasNoOverride()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);

        // Seed a user with DisplayName/Username on User entity, but NOT on membership
        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

            var user = new User
            {
                IdentityUserId = "user-with-name",
                Email = "named@test.com",
                DisplayName = "User Display Name",
                Username = "user_username",
            };
            dbContext.V3Users.Add(user);
            await dbContext.SaveChangesAsync();

            var membership = new OrganizationMembership
            {
                OrganizationId = org.Id,
                UserId = user.Id,
                Role = OrganizationRole.Member,
                Status = MembershipStatus.Active,
                // DisplayName and Username deliberately left null
            };
            dbContext.OrganizationMemberships.Add(membership);
            await dbContext.SaveChangesAsync();

            var leaguePlayer = new LeaguePlayer
            {
                OrganizationId = org.Id,
                LeagueId = league.Id,
                OrganizationMembershipId = membership.Id,
                Mmr = 1500,
                Mu = 25m,
                Sigma = 8.333m,
            };
            dbContext.LeaguePlayers.Add(leaguePlayer);
            await dbContext.SaveChangesAsync();
        }

        AuthenticateAs("user-with-name");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var leaderboard = await ReadJsonAsync<LeaderboardResponse>(response);
        Assert.NotNull(leaderboard);
        Assert.Single(leaderboard.Entries);

        var entry = leaderboard.Entries[0];
        // Should fall back to User.DisplayName when membership has no override
        Assert.Equal("User Display Name", entry.DisplayName);
        Assert.Equal("user_username", entry.Username);
    }
}
