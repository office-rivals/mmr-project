namespace MMRProject.Api.Data.Entities.V3;

/// <summary>
/// An NFC card linked to a member. Only a keyed hash of the card UID is kept (see <c>CardUidHasher</c>).
/// </summary>
public class PlayerCard : TenantEntity
{
    public Guid OrganizationMembershipId { get; set; }

    public required byte[] UidHmac { get; set; }

    /// <summary>Who linked it: the owner, or any member linking it for them.</summary>
    public Guid? LinkedByMembershipId { get; set; }

    public virtual OrganizationMembership OrganizationMembership { get; set; } = null!;

    public virtual OrganizationMembership? LinkedByMembership { get; set; }
}
