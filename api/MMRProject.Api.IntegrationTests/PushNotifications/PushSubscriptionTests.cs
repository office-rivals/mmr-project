using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.PushNotifications;

[Collection("Database")]
public class PushSubscriptionTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    private const string Endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
    private const string P256DH = "BPubKeyForTestingOnlyDoNotUseInProd";
    private const string Auth = "AuthSecretForTestingOnlyDoNotUseInProd";

    [Fact]
    public async Task Subscribe_ThenGetStatus_ReturnsSubscribed()
    {
        AuthenticateAs("user-1");

        var post = await Client.PostAsJsonAsync("api/v3/me/push/subscription",
            new PushSubscriptionRequest
            {
                Endpoint = Endpoint,
                Keys = new PushSubscriptionKeys { P256DH = P256DH, Auth = Auth },
            });

        Assert.Equal(HttpStatusCode.NoContent, post.StatusCode);

        var status = await ReadJsonAsync<PushSubscriptionStatusResponse>(
            await Client.GetAsync("api/v3/me/push/subscription"));

        Assert.NotNull(status);
        Assert.True(status!.Subscribed);
    }

    [Fact]
    public async Task Subscribe_TwiceWithSameEndpoint_DoesNotCreateDuplicateRow()
    {
        AuthenticateAs("user-1");

        await Client.PostAsJsonAsync("api/v3/me/push/subscription",
            new PushSubscriptionRequest
            {
                Endpoint = Endpoint,
                Keys = new PushSubscriptionKeys { P256DH = P256DH, Auth = Auth },
            });
        await Client.PostAsJsonAsync("api/v3/me/push/subscription",
            new PushSubscriptionRequest
            {
                Endpoint = Endpoint,
                Keys = new PushSubscriptionKeys { P256DH = "different-p256dh", Auth = "different-auth" },
            });

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var count = await db.PushSubscriptions.CountAsync();
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Unsubscribe_ThenGetStatus_ReturnsNotSubscribed()
    {
        AuthenticateAs("user-1");

        await Client.PostAsJsonAsync("api/v3/me/push/subscription",
            new PushSubscriptionRequest
            {
                Endpoint = Endpoint,
                Keys = new PushSubscriptionKeys { P256DH = P256DH, Auth = Auth },
            });

        var delete = await Client.DeleteAsync(
            $"api/v3/me/push/subscription?endpoint={Uri.EscapeDataString(Endpoint)}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var status = await ReadJsonAsync<PushSubscriptionStatusResponse>(
            await Client.GetAsync("api/v3/me/push/subscription"));

        Assert.NotNull(status);
        Assert.False(status!.Subscribed);
    }

    [Fact]
    public async Task Unsubscribe_OnlyAffectsRequestingUser()
    {
        // user-1 subscribes…
        AuthenticateAs("user-1");
        await Client.PostAsJsonAsync("api/v3/me/push/subscription",
            new PushSubscriptionRequest
            {
                Endpoint = Endpoint,
                Keys = new PushSubscriptionKeys { P256DH = P256DH, Auth = Auth },
            });

        // …user-2 subscribes on the same endpoint (different device profile)
        AuthenticateAs("user-2");
        await Client.PostAsJsonAsync("api/v3/me/push/subscription",
            new PushSubscriptionRequest
            {
                Endpoint = Endpoint,
                Keys = new PushSubscriptionKeys { P256DH = P256DH, Auth = Auth },
            });

        // user-2 unsubscribes; user-1's row must remain
        var delete = await Client.DeleteAsync(
            $"api/v3/me/push/subscription?endpoint={Uri.EscapeDataString(Endpoint)}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        AuthenticateAs("user-1");
        var status = await ReadJsonAsync<PushSubscriptionStatusResponse>(
            await Client.GetAsync("api/v3/me/push/subscription"));

        Assert.NotNull(status);
        Assert.True(status!.Subscribed);
    }

    [Fact]
    public async Task Subscribe_WithoutAuth_Returns401()
    {
        var response = await Client.PostAsJsonAsync("api/v3/me/push/subscription",
            new PushSubscriptionRequest
            {
                Endpoint = Endpoint,
                Keys = new PushSubscriptionKeys { P256DH = P256DH, Auth = Auth },
            });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}