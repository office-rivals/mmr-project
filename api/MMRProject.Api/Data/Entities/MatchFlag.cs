namespace MMRProject.Api.Data.Entities;

public class MatchFlag
{
    public long Id { get; set; }

    public long MatchId { get; set; }

    public long FlaggedById { get; set; }

    public string Reason { get; set; } = string.Empty;

    public MatchFlagStatus Status { get; set; }

    public string? ResolutionNote { get; set; }

    public long? ResolvedById { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public virtual Match Match { get; set; } = null!;

    public virtual Player FlaggedBy { get; set; } = null!;

    public virtual Player? ResolvedBy { get; set; }
}
