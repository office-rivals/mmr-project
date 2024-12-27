namespace MMRProject.Api.DTOs;

public record SubmitMatchV2Request
{
    public required MatchTeamV2 Team1 { get; set; }
    public required MatchTeamV2 Team2 { get; set; }
}