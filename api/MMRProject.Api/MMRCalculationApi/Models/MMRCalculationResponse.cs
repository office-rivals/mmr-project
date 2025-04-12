namespace MMRProject.Api.MMRCalculationApi.Models;

public record MMRCalculationResponse
{
    public required MMRCalculationTeamResult Team1 { get; init; }
    public required MMRCalculationTeamResult Team2 { get; init; }
}

public record GenerateTeamsResponse
{
    public required TeamV2Response Team1 { get; init; }
    public required TeamV2Response Team2 { get; init; }
}

public record TeamV2Response
{
    public required IEnumerable<PlayerV2Response> Players { get; init; }
}

public record PlayerV2Response
{
    public required long Id { get; init; }
    public required decimal Mu { get; init; }
    public required decimal Sigma { get; init; }
}

public record MMRCalculationTeamResult
{
    public required int Score { get; init; }
    public required IEnumerable<MMRCalculationPlayerResult> Players { get; init; }
}

public record MMRCalculationPlayerResult
{
    public required long Id { get; init; }
    public required decimal Mu { get; init; }
    public required decimal Sigma { get; init; }
    public required int MMR { get; init; }
}
