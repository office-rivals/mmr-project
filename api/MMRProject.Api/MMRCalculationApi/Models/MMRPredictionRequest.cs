namespace MMRProject.Api.MMRCalculationApi.Models;

public record MMRPredictionRequest
{
    public required MMRPredictionTeam Team1 { get; set; }
    public required MMRPredictionTeam Team2 { get; set; }
}

public record MMRPredictionTeam
{
    public required IEnumerable<MMRCalculationPlayerRating> Players { get; set; }
}
