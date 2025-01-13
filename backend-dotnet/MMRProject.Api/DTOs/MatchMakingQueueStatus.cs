namespace MMRProject.Api.DTOs;

public record MatchMakingQueueStatus
{
    public required bool UserInQueue { get; set; }
    public required int PlayersInQueue { get; set; }
}