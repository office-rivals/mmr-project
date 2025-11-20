using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs;

public record MatchFlagDetails
{
    [Required]
    public required long Id { get; set; }

    [Required]
    public required long MatchId { get; set; }

    [Required]
    public required MatchDetailsV2 Match { get; set; }

    [Required]
    public required string Reason { get; set; }

    [Required]
    public required string FlaggedByName { get; set; }

    [Required]
    public required long FlaggedById { get; set; }

    [Required]
    public required DateTime CreatedAt { get; set; }

    [Required]
    public required MatchFlagStatus Status { get; set; }

    public string? ResolutionNote { get; set; }

    public string? ResolvedByName { get; set; }

    public DateTime? ResolvedAt { get; set; }
}
