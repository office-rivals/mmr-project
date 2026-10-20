namespace MMRProject.Api.Data.Entities.V3;

/// <summary>
/// An unknown card scanned at a table, waiting for a member to link it via <c>/t/{ShortCode}</c>.
/// Short-lived: deleted when linked or once expired.
/// </summary>
public class CardLinkRequest : TenantEntity
{
    public Guid TableId { get; set; }

    public required byte[] UidHmac { get; set; }

    public string ShortCode { get; set; } = Data.ShortCode.New();

    public DateTimeOffset ExpiresAt { get; set; }
}
