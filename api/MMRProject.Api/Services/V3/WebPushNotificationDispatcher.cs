using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MMRProject.Api.Configuration;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using WebPush;

namespace MMRProject.Api.Services.V3;

public enum DispatchOutcome
{
    Delivered,
    SubscriptionGone,
    RetryableFailure,
    FatalFailure,
}

public record DispatchResult(DispatchOutcome Outcome, string? Error = null);

public interface INotificationDispatcher
{
    Task<DispatchResult> DispatchAsync(NotificationDelivery delivery, CancellationToken cancellationToken);
}

/// <summary>
/// Sends queued <see cref="NotificationDelivery"/> rows over the Web Push
/// protocol. Holds a long-lived <see cref="WebPushClient"/>; the library is
/// thread-safe and reuses HTTP connections across deliveries.
/// </summary>
public class WebPushNotificationDispatcher(
    IOptions<PushOptions> options,
    ApiDbContext dbContext,
    ILogger<WebPushNotificationDispatcher> logger) : INotificationDispatcher
{
    private readonly WebPushClient _client = new();
    private readonly VapidDetails _vapid = BuildVapid(options.Value);

    public async Task<DispatchResult> DispatchAsync(NotificationDelivery delivery, CancellationToken cancellationToken)
    {
        var subscription = await dbContext.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Id == delivery.SubscriptionId, cancellationToken);

        if (subscription is null || subscription.DeletedAt is not null)
        {
            return new DispatchResult(DispatchOutcome.SubscriptionGone);
        }

        var pushSubscription = new WebPush.PushSubscription(
            subscription.Endpoint,
            subscription.P256DH,
            subscription.Auth);

        try
        {
            await _client.SendNotificationAsync(pushSubscription, delivery.Payload, _vapid, cancellationToken);
            return new DispatchResult(DispatchOutcome.Delivered);
        }
        catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone
                                         || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Endpoint is dead — prune the subscription so the dispatcher stops
            // picking up its queued deliveries.
            subscription.DeletedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation(
                "Pruned push subscription {SubscriptionId} after {StatusCode} from push service",
                subscription.Id, (int)ex.StatusCode);
            return new DispatchResult(DispatchOutcome.SubscriptionGone, ex.Message);
        }
        catch (WebPushException ex) when ((int?)ex.StatusCode is null or >= 500
                                          || ex.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
        {
            return new DispatchResult(DispatchOutcome.RetryableFailure, ex.Message);
        }
        catch (WebPushException ex)
        {
            // 4xx other than 404/410 means the payload or auth is malformed —
            // retrying will just fail the same way.
            logger.LogWarning(ex,
                "Push service rejected delivery {DeliveryId} with {StatusCode}; giving up",
                delivery.Id, (int?)ex.StatusCode);
            return new DispatchResult(DispatchOutcome.FatalFailure, ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error dispatching notification {DeliveryId}", delivery.Id);
            return new DispatchResult(DispatchOutcome.RetryableFailure, ex.Message);
        }
    }

    private static VapidDetails BuildVapid(PushOptions options)
    {
        return new VapidDetails(options.Subject ?? "mailto:admin@example.com",
            options.Vapid.PublicKey,
            options.Vapid.PrivateKey);
    }
}