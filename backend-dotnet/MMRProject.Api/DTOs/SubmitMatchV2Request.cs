using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record SubmitMatchV2Request
{
    [Required]
    public required MatchTeamV2 Team1 { get; set; }

    [Required]
    public required MatchTeamV2 Team2 { get; set; }
}