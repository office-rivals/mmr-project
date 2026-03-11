namespace MMRProject.Api.Data.Entities.V3;

public class User : BaseEntity
{
    public required string IdentityUserId { get; set; }

    public required string Email { get; set; }

    public string? Username { get; set; }

    public string? DisplayName { get; set; }

    public long? LegacyPlayerId { get; set; }
}
