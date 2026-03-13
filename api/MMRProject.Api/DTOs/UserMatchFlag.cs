namespace MMRProject.Api.DTOs;

public record UserMatchFlag
{
    public required long Id { get; set; }
    public required long MatchId { get; set; }
    public required string Reason { get; set; }
    public required DateTime CreatedAt { get; set; }
}
