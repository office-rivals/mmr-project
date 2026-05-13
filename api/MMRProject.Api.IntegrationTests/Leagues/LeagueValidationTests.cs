using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Leagues;

[Collection("Database")]
public class LeagueValidationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task CreateLeague_WithTeamSizeLessThan1_ShouldFail(int teamSize)
    {
        var org = await CreateOrganization("Queue Org", "queue-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Bad League", Slug = "bad-league", TeamSize = teamSize });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(3)]
    [InlineData(4)]
    public async Task CreateLeague_WithTeamSizeGreaterThan2_ShouldFail(int teamSize)
    {
        var org = await CreateOrganization("Big Org", $"big-org-{teamSize}");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Big League", Slug = "big-league", TeamSize = teamSize });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateLeague_With1v1TeamSize_ShouldSucceed()
    {
        var org = await CreateOrganization("Singles Org", "singles-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "1v1 League", Slug = "one-v-one", TeamSize = 1 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task CreateLeague_DuplicateSlug_WithValidRequest_ReturnsConflictOrBadRequest()
    {
        var org = await CreateOrganization("Dup Org", "dup-org");
        await CreateLeague(org.Id, "First League", "first-league", teamSize: 2);
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        // Send a fully valid request (including TeamSize) so model validation doesn't reject it first
        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Second League", Slug = "first-league", TeamSize = 2 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
