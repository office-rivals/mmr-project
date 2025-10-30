using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record MatchDetailsV2
{
    [Required]
    public required long MatchId { get; set; }

    [Required]
    public DateTimeOffset Date { get; set; }

    [Required]
    public required MatchTeamV2 Team1 { get; set; }

    [Required]
    public required MatchTeamV2 Team2 { get; set; }

    public MatchMMRCalculationDetails? MMRCalculations { get; set; }
}

public record MatchTeamV2
{
    [Required]
    public required int Score { get; set; }

    [Required]
    public required long Member1 { get; set; }

    [Required]
    public required long Member2 { get; set; }
}

public record MatchMMRCalculationDetails
{
    [Required]
    public required MatchMMRCalculationTeam Team1 { get; set; }

    [Required]
    public required MatchMMRCalculationTeam Team2 { get; set; }
}

public record MatchMMRCalculationTeam
{
    [Required]
    public required int Player1MMRDelta { get; set; }

    [Required]
    public required int Player2MMRDelta { get; set; }
}