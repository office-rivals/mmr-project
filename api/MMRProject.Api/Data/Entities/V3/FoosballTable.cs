namespace MMRProject.Api.Data.Entities.V3;

public class FoosballTable : TenantEntity
{
    public required string Name { get; set; }

    /// <summary>
    /// Short-link code (<c>/t/{code}</c>), e.g. on its NFC sticker: random (uppercase Crockford) or a readable
    /// custom one (lowercase).
    /// </summary>
    public string ShortCode { get; set; } = Data.ShortCode.New();

    /// <summary>The league the table and its devices belong to: its games are scanned in, claimed and rated only here.</summary>
    public Guid LeagueId { get; set; }

    public const string DefaultLabelA = "Red";
    public const string DefaultLabelB = "White";

    /// <summary>The name of team A (it defends end A), shown when its players are unknown. Admins can rename it.</summary>
    public string EndLabelA { get; set; } = DefaultLabelA;

    /// <summary>The name of team B.</summary>
    public string EndLabelB { get; set; } = DefaultLabelB;

    /// <summary>
    /// Scoreboard sound volume (device config <c>sound_volume</c>): 0 off, 1 low, 2 medium, 3 high.
    /// </summary>
    public int SoundVolume { get; set; } = 2;

    /// <summary>
    /// Scoreboard state version. Bumped on every change to the table's matches; never repeats.
    /// </summary>
    public long StateVersion { get; set; }

    public virtual League League { get; set; } = null!;
}
