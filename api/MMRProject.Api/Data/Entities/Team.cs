namespace MMRProject.Api.Data.Entities;

public class Team
{
    public long Id { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public long? UserOneId { get; set; }

    public long? UserTwoId { get; set; }

    public long? Score { get; set; }

    public bool? Winner { get; set; }

    public virtual ICollection<Match> MatchTeamOnes { get; set; } = new List<Match>();

    public virtual ICollection<Match> MatchTeamTwos { get; set; } = new List<Match>();

    public virtual User? UserOne { get; set; }

    public virtual User? UserTwo { get; set; }
}
