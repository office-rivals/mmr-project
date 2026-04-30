using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Me;

[Collection("Database")]
public class MeTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GetMe_ReturnsUserWithOrganizations()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var (user, _, leaguePlayer) = await SeedTestUser(org.Id, league.Id, "me-user", "me@test.com",
            OrganizationRole.Owner);

        AuthenticateAs("me-user");

        var response = await Client.GetAsync("api/v3/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var me = await ReadJsonAsync<MeResponse>(response);
        Assert.NotNull(me);
        Assert.Equal(user.Id, me.Id);
        Assert.Equal("me-user", me.IdentityUserId);
        Assert.Single(me.Organizations);
        Assert.Equal(org.Id, me.Organizations[0].Id);
        Assert.Equal(OrganizationRole.Owner, me.Organizations[0].Role);
        Assert.Single(me.Organizations[0].Leagues);
        Assert.Equal(league.Id, me.Organizations[0].Leagues[0].Id);
        Assert.Equal(leaguePlayer.Id, me.Organizations[0].Leagues[0].LeaguePlayerId);
    }
}
