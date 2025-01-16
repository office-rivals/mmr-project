namespace MMRProject.Api.DTOs;

public record MatchMakingQueueStatus
{
    public required bool IsUserInQueue { get; set; }
    public required int PlayersInQueue { get; set; }
}