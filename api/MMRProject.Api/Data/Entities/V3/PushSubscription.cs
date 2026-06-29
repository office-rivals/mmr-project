namespace MMRProject.Api.Data.Entities.V3;

public class PushSubscription : BaseEntity
{
    /// <summary>
    /// Clerk user identifier (the JWT <c>sub</c> claim). Stored as a string
    /// rather than a FK to <see cref="User"/> because subscriptions belong to
    /// the external identity and should survive internal user-row churn.
    /// </summary>
    public required string UserId { get; set; }

    public required string Endpoint { get; set; }

    public required string P256DH { get; set; }

    public required string Auth { get; set; }

    public string? UserAgent { get; set; }

    public DateTimeOffset LastSeenAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }
}