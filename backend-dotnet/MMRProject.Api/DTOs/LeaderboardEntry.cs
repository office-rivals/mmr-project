namespace MMRProject.Api.DTOs;

public record LeaderboardEntry
{
    public required long UserId { get; set; }
    public required string Name { get; set; }
    public long? MMR { get; set; }
    public int Wins { get; set; }
    public int Loses { get; set; }
    public int WinningStreak { get; set; }
    public int LosingStreak { get; set; }
}