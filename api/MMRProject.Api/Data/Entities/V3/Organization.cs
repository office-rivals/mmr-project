namespace MMRProject.Api.Data.Entities.V3;

public class Organization : BaseEntity
{
    public required string Name { get; set; }

    public required string Slug { get; set; }
}
