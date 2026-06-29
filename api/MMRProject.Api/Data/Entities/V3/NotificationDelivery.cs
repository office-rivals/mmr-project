namespace MMRProject.Api.Data.Entities.V3;

public enum NotificationDeliveryStatus
{
    Pending = 0,
    Sent = 1,
    Dead = 2,
}

public class NotificationDelivery : BaseEntity
{
    public required string UserId { get; set; }

    public required Guid SubscriptionId { get; set; }

    public required string Payload { get; set; }

    public NotificationDeliveryStatus Status { get; set; } = NotificationDeliveryStatus.Pending;

    public int AttemptCount { get; set; }

    public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? SentAt { get; set; }

    public string? LastError { get; set; }

    public virtual PushSubscription Subscription { get; set; } = null!;
}