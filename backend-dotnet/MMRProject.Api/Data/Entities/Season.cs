namespace MMRProject.Api.Data.Entities;

public class Season
{
    public long Id { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public virtual ICollection<Match> Matches { get; set; } = new List<Match>();
}
