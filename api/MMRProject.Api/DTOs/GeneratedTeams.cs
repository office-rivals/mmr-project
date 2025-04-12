namespace MMRProject.Api.DTOs;

public record GenerateTeamsRequest
{
    public required List<string> ChipIds { get; init; }
}

public record GeneratedTeams
{
    public required TeamAssignment Team1 { get; init; }
    public required TeamAssignment Team2 { get; init; }
}

public record TeamAssignment
{
    public required List<string> ChipIds { get; init; }
}
