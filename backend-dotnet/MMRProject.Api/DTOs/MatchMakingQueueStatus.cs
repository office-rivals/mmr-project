using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record MatchMakingQueueStatus
{
    [Required]
    public required bool IsUserInQueue { get; set; }

    [Required]
    public required int PlayersInQueue { get; set; }
}