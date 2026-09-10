namespace MMRProject.Api.Data.Entities.V3;

public class PairingCode : BaseEntity
{
    public Guid UserId { get; set; }

    public required string Code { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? UsedAt { get; set; }

    public virtual User? User { get; set; }
}
