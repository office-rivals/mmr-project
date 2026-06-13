using System.Net;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Organizations;

[Collection("Database")]
public class InviteRateLimitTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GetInviteInfo_WhenBurstingPastLimit_ReturnsTooManyRequests()
    {
        AuthenticateAs("rate-limit-probe");

        // Burst well past the per-minute allowance. The exact count is decoupled
        // from the policy limit, and a burst this size guarantees a rejection
        // even if the fixed window happens to roll over mid-loop.
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 25; i++)
        {
            var response = await Client.GetAsync("api/v3/invites/ZZZZZZZZZZZZ");
            statuses.Add(response.StatusCode);
        }

        Assert.NotEqual(HttpStatusCode.TooManyRequests, statuses[0]);
        Assert.Contains(HttpStatusCode.TooManyRequests, statuses);
    }
}
