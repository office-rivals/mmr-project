namespace MMRProject.Api.Data.Entities.V3;

public enum TableMatchStatus
{
    Live = 0,

    /// <summary>Ended (winning score, saved, or idle) but not submitted; claimable for a while.</summary>
    Finished = 1,

    Discarded = 2,

    Submitted = 3
}

/// <summary>
/// A game played on a table, scored by its goal counters. Unclaimed (no players) unless linked to an
/// active matchmaking match; becomes a <see cref="V3Match"/> when submitted.
/// </summary>
/// <summary>How a table's roster was split into the linked match's teams.</summary>
public enum TeamsMode
{
    Fair,
    Random,
    Manual,
}

public class TableMatch : TenantEntity
{
    public Guid TableId { get; set; }

    public TableMatchStatus Status { get; set; }

    /// <summary>Short-link code (<c>/t/{code}</c>) for claiming this match from the scoreboard's QR code.</summary>
    public string ShortCode { get; set; } = Data.ShortCode.New();

    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset? EndedAt { get; set; }

    public DateTimeOffset LastActivityAt { get; set; }

    public int ScoreA { get; set; }

    public int ScoreB { get; set; }

    public Guid? ActiveMatchId { get; set; }

    /// <summary>Which team index of the linked active match plays at end A (0 or 1).</summary>
    public int ActiveMatchTeamIndexAtEndA { get; set; }

    /// <summary>
    /// The scoreboard's roster created the linked active match, so the table also deletes it when the game
    /// is dropped unplayed (teams dissolved, idle, or an invalid result before a rematch).
    /// </summary>
    public bool OwnsActiveMatch { get; set; }

    /// <summary>
    /// When a linked match that reached the winning score is rated automatically; null when nothing is
    /// pending (an undo clears it, a submit uses it up).
    /// </summary>
    public DateTimeOffset? AutoSubmitAt { get; set; }

    public Guid? MatchId { get; set; }

    /// <summary>The member who pressed "New game" for it on the phone (save or discard); null otherwise.</summary>
    public Guid? EndedByMembershipId { get; set; }

    /// <summary>How the scoreboard made the linked teams; null when not made there (linked in the app, or none).</summary>
    public TeamsMode? TeamsMode { get; set; }

    public virtual FoosballTable Table { get; set; } = null!;

    public virtual V3ActiveMatch? ActiveMatch { get; set; }

    public virtual ICollection<TableGoal> Goals { get; set; } = new List<TableGoal>();
}
