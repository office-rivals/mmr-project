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
    [InlineData(1)]
    [InlineData(-1)]
    public async Task CreateLeague_WithQueueSizeLessThan2_ShouldFail(int queueSize)
    {
        var org = await CreateOrganization("Queue Org", "queue-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Bad League", Slug = "bad-league", QueueSize = queueSize });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateLeague_DuplicateSlug_WithValidRequest_ReturnsConflictOrBadRequest()
    {
        var org = await CreateOrganization("Dup Org", "dup-org");
        await CreateLeague(org.Id, "First League", "first-league", queueSize: 4);
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        // Send a fully valid request (including QueueSize) so model validation doesn't reject it first
        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Second League", Slug = "first-league", QueueSize = 4 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
