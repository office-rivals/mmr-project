using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Extensions;

namespace MMRProject.Api.Services.V3;

public interface IV3LeaderboardService
{
    Task<LeaderboardResponse> GetLeaderboardAsync(Guid orgId, Guid leagueId, Guid? seasonId);
}

public class V3LeaderboardService(ApiDbContext dbContext) : IV3LeaderboardService
{
    private const int RankedMatchThreshold = 10;

    public async Task<LeaderboardResponse> GetLeaderboardAsync(Guid orgId, Guid leagueId, Guid? seasonId)
    {
        var stats = await GetPlayerStatsAsync(orgId, leagueId, seasonId);

        var leaguePlayers = await dbContext.Set<LeaguePlayer>()
            .AsNoTracking()
            .Include(lp => lp.OrganizationMembership)
                .ThenInclude(m => m.User)
            .Where(lp => lp.OrganizationId == orgId && lp.LeagueId == leagueId)
            .ToListAsync();

        var entries = leaguePlayers
            .Select(lp =>
            {
                var stat = stats.GetValueOrDefault(lp.Id);
                var wins = stat?.Wins ?? 0;
                var losses = stat?.Losses ?? 0;
                var totalMatches = wins + losses;
                long? mmr = seasonId.HasValue
                    ? stat?.Mmr
                    : lp.Mmr;
                if (totalMatches < RankedMatchThreshold)
                    mmr = null;

                return new LeaderboardEntryResponse
                {
                    LeaguePlayerId = lp.Id,
                    DisplayName = lp.OrganizationMembership.GetDisplayName(),
                    Username = lp.OrganizationMembership.GetUsername(),
                    Mmr = mmr,
                    Mu = lp.Mu,
                    Sigma = lp.Sigma,
                    Rank = 0,
                    Wins = wins,
                    Losses = losses,
                    WinningStreak = stat?.WinningStreak ?? 0,
                    LosingStreak = stat?.LosingStreak ?? 0,
                };
            })
            .Where(e => seasonId == null || stats.ContainsKey(e.LeaguePlayerId))
            .OrderByDescending(e => e.Mmr.HasValue)
            .ThenByDescending(e => e.Mmr ?? 0)
            .ThenByDescending(e => e.Wins - e.Losses)
            .ThenByDescending(e => e.LeaguePlayerId)
            .ToList();

        return new LeaderboardResponse { Entries = AssignRanks(entries) };
    }

    private async Task<Dictionary<Guid, PlayerStats>> GetPlayerStatsAsync(Guid orgId, Guid leagueId, Guid? seasonId)
    {
        const string sql = """
            WITH player_matches AS (
                SELECT mtp.league_player_id AS player_id,
                       mt.match_id,
                       mt.is_winner,
                       m.played_at,
                       m.recorded_at,
                       m.created_at AS match_created_at
                FROM match_team_players mtp
                INNER JOIN match_teams mt ON mt.id = mtp.match_team_id
                INNER JOIN matches m ON m.id = mt.match_id
                WHERE m.organization_id = {0}
                  AND m.league_id = {1}
                  AND ({2}::uuid IS NULL OR m.season_id = {2}::uuid)
            ),
            ordered_player_matches AS (
                SELECT player_id,
                       match_id,
                       is_winner,
                       ROW_NUMBER() OVER (
                           PARTITION BY player_id
                           ORDER BY played_at DESC, recorded_at DESC, match_created_at DESC, match_id DESC
                       ) AS match_seq
                FROM player_matches
            ),
            streak_groups AS (
                SELECT player_id,
                       is_winner,
                       match_seq,
                       match_seq - ROW_NUMBER() OVER (PARTITION BY player_id, is_winner ORDER BY match_seq) AS streak_group_id
                FROM ordered_player_matches
            ),
            current_streaks AS (
                SELECT sg.player_id,
                       sg.is_winner,
                       COUNT(*) AS streak_length
                FROM streak_groups sg
                INNER JOIN (
                    SELECT player_id, streak_group_id, is_winner
                    FROM streak_groups
                    WHERE match_seq = 1
                ) seed
                ON seed.player_id = sg.player_id
                  AND seed.streak_group_id = sg.streak_group_id
                  AND seed.is_winner = sg.is_winner
                GROUP BY sg.player_id, sg.is_winner
            ),
            latest_season_mmr AS (
                SELECT DISTINCT ON (rh.league_player_id)
                       rh.league_player_id,
                       rh.mmr,
                       m.played_at,
                       m.recorded_at,
                       m.created_at AS match_created_at,
                       m.id AS match_id
                FROM rating_histories rh
                INNER JOIN matches m ON m.id = rh.match_id
                WHERE m.organization_id = {0}
                  AND m.league_id = {1}
                  AND ({2}::uuid IS NULL OR m.season_id = {2}::uuid)
                ORDER BY rh.league_player_id,
                         m.played_at DESC, m.recorded_at DESC, m.created_at DESC, m.id DESC
            )
            SELECT pm.player_id AS PlayerId,
                   COUNT(*) FILTER (WHERE pm.is_winner)::int AS Wins,
                   COUNT(*) FILTER (WHERE NOT pm.is_winner)::int AS Losses,
                   COALESCE((SELECT streak_length FROM current_streaks cs WHERE cs.player_id = pm.player_id AND cs.is_winner), 0)::int AS WinningStreak,
                   COALESCE((SELECT streak_length FROM current_streaks cs WHERE cs.player_id = pm.player_id AND NOT cs.is_winner), 0)::int AS LosingStreak,
                   ls.mmr AS Mmr
            FROM player_matches pm
            LEFT JOIN latest_season_mmr ls ON ls.league_player_id = pm.player_id
            GROUP BY pm.player_id, ls.mmr
        """;

        var seasonParam = seasonId.HasValue ? (object)seasonId.Value : DBNull.Value;
        var rows = await dbContext.Database
            .SqlQueryRaw<PlayerStatsRow>(sql, orgId, leagueId, seasonParam)
            .ToListAsync();

        return rows.ToDictionary(
            r => r.PlayerId,
            r => new PlayerStats
            {
                Wins = r.Wins,
                Losses = r.Losses,
                WinningStreak = r.WinningStreak,
                LosingStreak = r.LosingStreak,
                Mmr = r.Mmr,
            });
    }

    private static List<LeaderboardEntryResponse> AssignRanks(List<LeaderboardEntryResponse> entries)
    {
        var rank = 1;
        for (var i = 0; i < entries.Count; i++)
        {
            if (entries[i].Mmr == null)
            {
                entries[i] = entries[i] with { Rank = 0 };
                continue;
            }

            if (i > 0 && entries[i - 1].Mmr.HasValue && entries[i].Mmr < entries[i - 1].Mmr)
                rank = i + 1;

            entries[i] = entries[i] with { Rank = rank };
        }

        return entries;
    }

    private record PlayerStatsRow
    {
        public Guid PlayerId { get; init; }
        public int Wins { get; init; }
        public int Losses { get; init; }
        public int WinningStreak { get; init; }
        public int LosingStreak { get; init; }
        public long? Mmr { get; init; }
    }

    private record PlayerStats
    {
        public int Wins { get; init; }
        public int Losses { get; init; }
        public int WinningStreak { get; init; }
        public int LosingStreak { get; init; }
        public long? Mmr { get; init; }
    }
}
