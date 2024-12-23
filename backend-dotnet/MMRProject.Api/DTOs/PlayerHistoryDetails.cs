namespace MMRProject.Api.DTOs;

public record PlayerHistoryDetails
{
    public required long UserId { get; set; }
    public required string Name { get; set; }
    public required DateTimeOffset Date { get; set; }
    public required long MMR { get; set; }
}