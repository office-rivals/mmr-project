namespace MMRProject.Api.DTOs;

public record MatchDetailsV2
{
    public DateTimeOffset Date { get; set; }
    public required MatchTeamV2 Team1 { get; set; }
    public required MatchTeamV2 Team2 { get; set; }
    public MatchMMRCalculationDetails? MMRCalculations { get; set; }
}

public record MatchTeamV2
{
    public required int Score { get; set; }
    public required long Member1 { get; set; }
    public required long Member2 { get; set; }
}

public record MatchMMRCalculationDetails
{
    public required MatchMMRCalculationTeam Team1 { get; set; }
    public required MatchMMRCalculationTeam Team2 { get; set; }
}

public record MatchMMRCalculationTeam
{
    public required int Player1MMRDelta { get; set; }
    public required int Player2MMRDelta { get; set; }
}