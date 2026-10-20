using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Services.V3;

/// <summary>Splits players into two teams by MMR (snake draft), for matchmaking and table rosters.</summary>
public static class TeamBalancer
{
    /// <summary>Snake draft by MMR: best to team 0, next two to team 1, and so on. Deterministic.</summary>
    public static List<List<LeaguePlayer>> Split(List<LeaguePlayer> players)
    {
        var sorted = players.OrderByDescending(p => p.Mmr).ToList();
        var teamCount = 2;
        var teamPlayers = new List<List<LeaguePlayer>>();
        for (var i = 0; i < teamCount; i++)
        {
            teamPlayers.Add(new List<LeaguePlayer>());
        }

        for (var i = 0; i < sorted.Count; i++)
        {
            var round = i / teamCount;
            var posInRound = i % teamCount;
            var teamIndex = round % 2 == 0 ? posInRound : teamCount - 1 - posInRound;
            teamPlayers[teamIndex].Add(sorted[i]);
        }

        return teamPlayers;
    }

    /// <summary>A uniform random split into two equal halves.</summary>
    public static List<List<LeaguePlayer>> RandomSplit(List<LeaguePlayer> players)
    {
        var shuffled = players.ToArray();
        Random.Shared.Shuffle(shuffled);
        return [shuffled[..(shuffled.Length / 2)].ToList(), shuffled[(shuffled.Length / 2)..].ToList()];
    }

    public static List<PendingMatchTeam> Balance(List<LeaguePlayer> players, Guid orgId, Guid leagueId) =>
        ToPendingMatchTeams(Split(players).Select(t => t.Select(p => p.Id).ToList()).ToList(), orgId, leagueId);

    public static List<PendingMatchTeam> ToPendingMatchTeams(List<List<Guid>> teams, Guid orgId, Guid leagueId) =>
        teams.Select((players, index) => new PendingMatchTeam
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            Index = index,
            Players = players.Select((leaguePlayerId, playerIndex) => new PendingMatchTeamPlayer
            {
                LeaguePlayerId = leaguePlayerId,
                Index = playerIndex
            }).ToList()
        }).ToList();
}
