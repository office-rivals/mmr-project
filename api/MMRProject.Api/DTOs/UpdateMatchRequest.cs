using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record UpdateMatchRequest
{
    [Required]
    public required MatchTeamV2 Team1 { get; set; }

    [Required]
    public required MatchTeamV2 Team2 { get; set; }

    [Required]
    public required long SeasonId { get; set; }
}
