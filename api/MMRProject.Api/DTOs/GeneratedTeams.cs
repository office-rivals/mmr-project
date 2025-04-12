namespace MMRProject.Api.DTOs;

public record GenerateTeamsRequest
{
    public required List<string> ChipIds { get; init; }
}
