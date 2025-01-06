namespace MMRProject.Api.MMRCalculationApi.Models;

public record MMRCalculationRequest
{
    public required MMRCalculationTeam Team1 { get; set; }
    public required MMRCalculationTeam Team2 { get; set; }
}

public record MMRCalculationTeam
{
    public required int Score { get; set; }
    public required IEnumerable<MMRCalculationPlayerRating> Players { get; set; }
}

public record MMRCalculationPlayerRating
{
    public required long Id { get; set; }
    public decimal? Mu { get; set; }
    public decimal? Sigma { get; set; }
    public bool? IsPreviousSeasonRating { get; set; }
}