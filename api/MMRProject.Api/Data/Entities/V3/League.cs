namespace MMRProject.Api.Data.Entities.V3;

public class League : TenantEntity
{
    public required string Name { get; set; }

    public required string Slug { get; set; }

    public int TeamSize { get; set; } = 2;

    public virtual Organization Organization { get; set; } = null!;
}
