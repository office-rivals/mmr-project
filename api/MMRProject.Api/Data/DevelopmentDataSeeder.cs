using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Data;

public class DevelopmentDataSeeder(ApiDbContext dbContext, ILogger<DevelopmentDataSeeder> logger)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var season = await EnsureSeasonAsync(cancellationToken);
        var players = await EnsurePlayersAsync(cancellationToken);

        if (await dbContext.Matches.AnyAsync(x => x.SeasonId == season.Id, cancellationToken))
        {
            logger.LogInformation("Development demo matches already exist for season {SeasonId}", season.Id);
            return;
        }

        await SeedMatchesAsync(season, players, cancellationToken);
    }

    private async Task<Season> EnsureSeasonAsync(CancellationToken cancellationToken)
    {
        var currentSeason = await dbContext.Seasons
            .OrderByDescending(x => x.StartsAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (currentSeason != null)
        {
            return currentSeason;
        }

        currentSeason = new Season
        {
            StartsAt = DateTimeOffset.UtcNow.AddDays(-30),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        dbContext.Seasons.Add(currentSeason);
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Seeded development season {SeasonId}", currentSeason.Id);
        return currentSeason;
    }

    private async Task<Dictionary<string, Player>> EnsurePlayersAsync(CancellationToken cancellationToken)
    {
        var seedPlayers = new[]
        {
            new SeedPlayer("demo-owner", "Demo Owner", "owner@demo.local", "dev-owner", PlayerRole.Owner),
            new SeedPlayer("demo-moderator", "Demo Moderator", "moderator@demo.local", "dev-moderator", PlayerRole.Moderator),
            new SeedPlayer("demo-user", "Demo User", "user@demo.local", "dev-user", PlayerRole.User),
            new SeedPlayer("demo-rival", "Demo Rival", "rival@demo.local", null, PlayerRole.User),
            new SeedPlayer("demo-sam", "Demo Sam", "sam@demo.local", null, PlayerRole.User),
            new SeedPlayer("demo-jules", "Demo Jules", "jules@demo.local", null, PlayerRole.User),
            new SeedPlayer("demo-lee", "Demo Lee", "lee@demo.local", null, PlayerRole.User),
            new SeedPlayer("demo-casey", "Demo Casey", "casey@demo.local", null, PlayerRole.User),
        };

        var existingPlayers = await dbContext.Players
            .IgnoreQueryFilters()
            .Where(player => seedPlayers.Select(seed => seed.Name).Contains(player.Name!))
            .ToListAsync(cancellationToken);

        var existingByName = existingPlayers.ToDictionary(player => player.Name!);

        foreach (var seedPlayer in seedPlayers)
        {
            if (existingByName.TryGetValue(seedPlayer.Name, out var existingPlayer))
            {
                existingPlayer.DisplayName = seedPlayer.DisplayName;
                existingPlayer.Email = seedPlayer.Email;
                existingPlayer.IdentityUserId = seedPlayer.IdentityUserId;
                existingPlayer.Role = seedPlayer.Role;
                existingPlayer.Mmr ??= 1000;
                existingPlayer.Mu ??= 25m;
                existingPlayer.Sigma ??= 8.333m;
                existingPlayer.UpdatedAt = DateTime.UtcNow;
                continue;
            }

            dbContext.Players.Add(new Player
            {
                Name = seedPlayer.Name,
                DisplayName = seedPlayer.DisplayName,
                Email = seedPlayer.Email,
                IdentityUserId = seedPlayer.IdentityUserId,
                Role = seedPlayer.Role,
                Mmr = 1000,
                Mu = 25m,
                Sigma = 8.333m,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var players = await dbContext.Players
            .Where(player => seedPlayers.Select(seed => seed.Name).Contains(player.Name!))
            .ToDictionaryAsync(player => player.Name!, cancellationToken);

        logger.LogInformation("Ensured {Count} development demo players", players.Count);
        return players;
    }

    private async Task SeedMatchesAsync(Season season, IReadOnlyDictionary<string, Player> players,
        CancellationToken cancellationToken)
    {
        var matchDefinitions = new[]
        {
            new SeedMatch("demo-owner", "demo-user", "demo-moderator", "demo-rival", 21, 18),
            new SeedMatch("demo-owner", "demo-moderator", "demo-user", "demo-rival", 17, 21),
            new SeedMatch("demo-owner", "demo-rival", "demo-moderator", "demo-user", 21, 16),
            new SeedMatch("demo-owner", "demo-user", "demo-rival", "demo-moderator", 19, 21),
            new SeedMatch("demo-owner", "demo-moderator", "demo-rival", "demo-user", 21, 14),
            new SeedMatch("demo-owner", "demo-rival", "demo-user", "demo-moderator", 15, 21),
            new SeedMatch("demo-owner", "demo-user", "demo-moderator", "demo-rival", 22, 20),
            new SeedMatch("demo-owner", "demo-moderator", "demo-user", "demo-rival", 18, 21),
            new SeedMatch("demo-owner", "demo-rival", "demo-moderator", "demo-user", 21, 19),
            new SeedMatch("demo-owner", "demo-user", "demo-rival", "demo-moderator", 21, 17),
            new SeedMatch("demo-sam", "demo-jules", "demo-lee", "demo-casey", 21, 13),
            new SeedMatch("demo-lee", "demo-casey", "demo-sam", "demo-jules", 18, 21),
        };

        var ratings = players.Values.ToDictionary(player => player.Id, _ => 1000);
        var baseDate = DateTime.UtcNow.AddDays(-20);
        var newTeams = new List<Team>();
        var newMatches = new List<Match>();
        var newPlayerHistories = new List<PlayerHistory>();
        var newMmrCalculations = new List<MmrCalculation>();

        for (var i = 0; i < matchDefinitions.Length; i++)
        {
            var definition = matchDefinitions[i];
            var teamOnePlayerOne = players[definition.TeamOnePlayerOne];
            var teamOnePlayerTwo = players[definition.TeamOnePlayerTwo];
            var teamTwoPlayerOne = players[definition.TeamTwoPlayerOne];
            var teamTwoPlayerTwo = players[definition.TeamTwoPlayerTwo];

            var createdAt = baseDate.AddDays(i * 2);
            var teamOneWon = definition.TeamOneScore > definition.TeamTwoScore;
            var delta = 12 + Math.Abs(definition.TeamOneScore - definition.TeamTwoScore) / 2;

            var teamOne = new Team
            {
                PlayerOneId = teamOnePlayerOne.Id,
                PlayerTwoId = teamOnePlayerTwo.Id,
                Score = definition.TeamOneScore,
                Winner = teamOneWon,
                CreatedAt = createdAt,
                UpdatedAt = createdAt,
            };

            var teamTwo = new Team
            {
                PlayerOneId = teamTwoPlayerOne.Id,
                PlayerTwoId = teamTwoPlayerTwo.Id,
                Score = definition.TeamTwoScore,
                Winner = !teamOneWon,
                CreatedAt = createdAt,
                UpdatedAt = createdAt,
            };

            var match = new Match
            {
                SeasonId = season.Id,
                TeamOne = teamOne,
                TeamTwo = teamTwo,
                CreatedAt = createdAt,
                UpdatedAt = createdAt,
            };

            var teamOneDelta = teamOneWon ? delta : -delta;
            var teamTwoDelta = -teamOneDelta;

            ApplyRating(teamOnePlayerOne.Id, teamOneDelta);
            ApplyRating(teamOnePlayerTwo.Id, teamOneDelta);
            ApplyRating(teamTwoPlayerOne.Id, teamTwoDelta);
            ApplyRating(teamTwoPlayerTwo.Id, teamTwoDelta);

            newTeams.Add(teamOne);
            newTeams.Add(teamTwo);
            newMatches.Add(match);

            newMmrCalculations.Add(new MmrCalculation
            {
                Match = match,
                CreatedAt = createdAt,
                UpdatedAt = createdAt,
                TeamOnePlayerOneMmrDelta = teamOneDelta,
                TeamOnePlayerTwoMmrDelta = teamOneDelta,
                TeamTwoPlayerOneMmrDelta = teamTwoDelta,
                TeamTwoPlayerTwoMmrDelta = teamTwoDelta,
            });

            newPlayerHistories.Add(CreatePlayerHistory(teamOnePlayerOne.Id, ratings[teamOnePlayerOne.Id], match, createdAt));
            newPlayerHistories.Add(CreatePlayerHistory(teamOnePlayerTwo.Id, ratings[teamOnePlayerTwo.Id], match, createdAt));
            newPlayerHistories.Add(CreatePlayerHistory(teamTwoPlayerOne.Id, ratings[teamTwoPlayerOne.Id], match, createdAt));
            newPlayerHistories.Add(CreatePlayerHistory(teamTwoPlayerTwo.Id, ratings[teamTwoPlayerTwo.Id], match, createdAt));
        }

        await dbContext.Teams.AddRangeAsync(newTeams, cancellationToken);
        await dbContext.Matches.AddRangeAsync(newMatches, cancellationToken);
        await dbContext.MmrCalculations.AddRangeAsync(newMmrCalculations, cancellationToken);
        await dbContext.PlayerHistories.AddRangeAsync(newPlayerHistories, cancellationToken);

        foreach (var player in players.Values)
        {
            player.Mmr = ratings[player.Id];
            player.Mu = ToMu(ratings[player.Id]);
            player.Sigma = ToSigma(matchDefinitions.Length);
            player.UpdatedAt = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Seeded {MatchCount} development demo matches", matchDefinitions.Length);

        void ApplyRating(long playerId, int delta)
        {
            ratings[playerId] += delta;
        }
    }

    private static PlayerHistory CreatePlayerHistory(long playerId, int mmr, Match match, DateTime createdAt)
    {
        return new PlayerHistory
        {
            PlayerId = playerId,
            Match = match,
            Mmr = mmr,
            Mu = ToMu(mmr),
            Sigma = ToSigma(1),
            CreatedAt = createdAt,
            UpdatedAt = createdAt,
        };
    }

    private static decimal ToMu(int mmr)
    {
        return Math.Round(25m + (mmr - 1000) / 40m, 3);
    }

    private static decimal ToSigma(int matchCount)
    {
        return Math.Max(5m, 8.333m - (matchCount * 0.05m));
    }

    private sealed record SeedPlayer(string Name, string DisplayName, string Email, string? IdentityUserId, PlayerRole Role);

    private sealed record SeedMatch(
        string TeamOnePlayerOne,
        string TeamOnePlayerTwo,
        string TeamTwoPlayerOne,
        string TeamTwoPlayerTwo,
        int TeamOneScore,
        int TeamTwoScore);
}
