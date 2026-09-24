namespace MMRProject.Api.Data.Entities.V3;

public class RfidTag : BaseEntity
{
    public Guid UserId { get; set; }

    public required string RfidUid { get; set; }

    public virtual User? User { get; set; }
}
