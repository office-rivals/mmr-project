using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record CreateMatchFlagRequest
{
    [Required] public required Guid MatchId { get; init; }
    [Required] public required string Reason { get; init; }
}

public record ResolveMatchFlagRequest
{
    [Required] public required MatchFlagStatus Status { get; init; }
    public string? ResolutionNote { get; init; }
}

public record MatchFlagResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid MatchId { get; init; }
    [Required] public required Guid FlaggedByMembershipId { get; init; }
    public string? FlaggedByDisplayName { get; init; }
    [Required] public required string Reason { get; init; }
    [Required] public required MatchFlagStatus Status { get; init; }
    public string? ResolutionNote { get; init; }
    public Guid? ResolvedByMembershipId { get; init; }
    public string? ResolvedByDisplayName { get; init; }
    public DateTimeOffset? ResolvedAt { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}
