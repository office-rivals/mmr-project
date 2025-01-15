namespace MMRProject.Api.DTOs;

public record ActiveMatchDto
{
    public long Id { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    
    public required ActiveMatchTeamDto Team1 { get; set; }
    public required ActiveMatchTeamDto Team2 { get; set; }
        
}

public record ActiveMatchTeamDto
{
    public required IEnumerable<long> PlayerIds { get; set; }
}