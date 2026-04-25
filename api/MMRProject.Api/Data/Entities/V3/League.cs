namespace MMRProject.Api.Data.Entities.V3;

public class League : TenantEntity
{
    public required string Name { get; set; }

    public required string Slug { get; set; }

    public int QueueSize { get; set; } = 4;

    public virtual Organization Organization { get; set; } = null!;
}
