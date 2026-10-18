namespace MMRProject.Api.Data.Entities.V3;

public class Organization : BaseEntity
{
    public required string Name { get; set; }

    public required string Slug { get; set; }

    /// <summary>SHA-256 of the token table devices use to enrol into this organization.</summary>
    public byte[]? DeviceEnrolmentTokenHash { get; set; }

    public DateTimeOffset? DeviceEnrolmentTokenCreatedAt { get; set; }
}
