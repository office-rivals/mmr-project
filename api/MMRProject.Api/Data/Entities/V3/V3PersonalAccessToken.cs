namespace MMRProject.Api.Data.Entities.V3;

public class V3PersonalAccessToken : BaseEntity
{
    public Guid UserId { get; set; }

    public Guid? OrganizationId { get; set; }

    public Guid? LeagueId { get; set; }

    public required string Scope { get; set; }

    public required byte[] TokenHash { get; set; }

    public required string Name { get; set; }

    public DateTimeOffset? LastUsedAt { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }

    public long? LegacyPatId { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Organization? Organization { get; set; }

    public virtual League? League { get; set; }
}
