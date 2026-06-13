using System.Net;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Organizations;

[Collection("Database")]
public class InviteRateLimitTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GetInviteInfo_AfterExceedingLimit_ReturnsTooManyRequests()
    {
        AuthenticateAs("rate-limit-probe");

        // Policy allows 10 lookups/minute per user; the 11th must be rejected.
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 11; i++)
        {
            var response = await Client.GetAsync("api/v3/invites/ZZZZZZZZZZZZ");
            statuses.Add(response.StatusCode);
        }

        Assert.DoesNotContain(HttpStatusCode.TooManyRequests, statuses.Take(10));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[10]);
    }
}
