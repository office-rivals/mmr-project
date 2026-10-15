namespace MMRProject.Api.MMRCalculationApi.Models;

public record MMRPredictionResponse
{
    public required MMRTeamPrediction Team1 { get; init; }
    public required MMRTeamPrediction Team2 { get; init; }
}

public record MMRTeamPrediction
{
    public required double WinChance { get; init; }
    public required IEnumerable<MMRPlayerPrediction> Players { get; init; }
}

public record MMRPlayerPrediction
{
    public required long Id { get; init; }
    public required int Mmr { get; init; }
    public required int MmrIfWin { get; init; }
    public required int MmrIfLose { get; init; }
}
