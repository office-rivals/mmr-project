using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Services.V3;

public class NotificationQueueService(
    ApiDbContext dbContext,
    ILogger<NotificationQueueService> logger) : INotificationQueue
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task EnqueueForUserAsync(
        string userId,
        NotificationPayload payload,
        CancellationToken cancellationToken = default)
    {
        var subscriptions = await dbContext.PushSubscriptions
            .Where(s => s.UserId == userId && s.DeletedAt == null)
            .ToListAsync(cancellationToken);

        if (subscriptions.Count == 0)
        {
            return;
        }

        var payloadJson = JsonSerializer.Serialize(payload, JsonOptions);

        foreach (var subscription in subscriptions)
        {
            dbContext.NotificationDeliveries.Add(new NotificationDelivery
            {
                UserId = userId,
                SubscriptionId = subscription.Id,
                Payload = payloadJson,
                Status = NotificationDeliveryStatus.Pending,
                NextAttemptAt = DateTimeOffset.UtcNow,
            });
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to enqueue notification for user {UserId}", userId);
            throw;
        }
    }
}