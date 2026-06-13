namespace MMRProject.Api.Data.Entities.V3;

public class League : TenantEntity
{
    public required string Name { get; set; }

    public required string Slug { get; set; }

    public int TeamSize { get; set; } = 2;

    /// <summary>
    /// Fixed score that the winning team must reach. Null = free-form scoring
    /// (highest score wins, no shape constraint). Existing leagues are
    /// backfilled to 10 to preserve current behaviour.
    /// </summary>
    public int? WinningScore { get; set; }

    public virtual Organization Organization { get; set; } = null!;
}
