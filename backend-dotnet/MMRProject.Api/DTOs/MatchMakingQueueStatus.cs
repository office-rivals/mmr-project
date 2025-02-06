using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs;

public record MatchMakingQueueStatus
{
    [Required]
    public required bool IsUserInQueue { get; set; }

    [Required]
    public required int PlayersInQueue { get; set; }
    
    public MatchMakingQueueStatusPendingMatch? AssignedPendingMatch { get; set; }
    
    public ActiveMatchDto? AssignedActiveMatch { get; set; }
}

public record MatchMakingQueueStatusPendingMatch
{
    [Required]
    public required Guid Id { get; set; }
    
    [Required]
    public required PendingMatchStatus Status { get; set; }
    
    [Required]
    public required DateTimeOffset ExpiresAt { get; set; }
}