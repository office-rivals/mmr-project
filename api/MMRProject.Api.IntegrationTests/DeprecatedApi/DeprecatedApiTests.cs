using System.Net;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.DeprecatedApi;

[Collection("Database")]
public class DeprecatedApiTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task LegacyV1Endpoints_Return410()
    {
        AuthenticateAs("test-user");

        var endpoints = new[] { "api/v1/users", "api/v1/seasons", "api/v1/matches" };
        foreach (var endpoint in endpoints)
        {
            var response = await Client.GetAsync(endpoint);
            Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
        }
    }

    [Fact]
    public async Task LegacyV2Endpoints_Return410()
    {
        AuthenticateAs("test-user");

        var response = await Client.GetAsync("api/v2/mmr");
        Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
    }

    [Fact]
    public async Task LegacyV1Post_Returns410()
    {
        AuthenticateAs("test-user");

        var response = await Client.PostAsJsonAsync("api/v1/users", new { });
        Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
    }
}
