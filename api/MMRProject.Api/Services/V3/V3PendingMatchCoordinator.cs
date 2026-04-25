using Microsoft.EntityFrameworkCore;
using Npgsql;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Services.V3;

public interface IV3PendingMatchCoordinator
{
    Task<bool> ProcessOnceAsync(CancellationToken cancellationToken = default);
}

public class V3PendingMatchCoordinator(
    ILogger<V3PendingMatchCoordinator> logger,
    ApiDbContext dbContext) : IV3PendingMatchCoordinator
{
    private const string PendingMatchIndexName = "ix_pending_matches_league_pending";

    public async Task<bool> ProcessOnceAsync(CancellationToken cancellationToken = default)
    {
        var expiredCount = await ExpirePendingMatchesAsync(cancellationToken);
        var createdCount = await CreatePendingMatchesAsync(cancellationToken);

        return expiredCount > 0 || createdCount > 0;
    }

    private async Task<int> ExpirePendingMatchesAsync(CancellationToken cancellationToken)
    {
        var expiredMatchIds = await dbContext.V3PendingMatches
            .AsNoTracking()
            .Where(pm => pm.Status == AcceptanceStatus.Pending)
            .Where(pm => pm.ExpiresAt.AddSeconds(1) < DateTimeOffset.UtcNow)
            .Select(pm => pm.Id)
            .ToListAsync(cancellationToken);

        if (expiredMatchIds.Count == 0)
        {
            return 0;
        }

        var expiredCount = 0;
        foreach (var pendingMatchId in expiredMatchIds)
        {
            if (await ExpirePendingMatchAsync(pendingMatchId, cancellationToken))
            {
                expiredCount++;
            }
        }

        return expiredCount;
    }

    private async Task<bool> ExpirePendingMatchAsync(Guid pendingMatchId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var pendingMatch = await dbContext.V3PendingMatches
            .FromSqlInterpolated($"SELECT * FROM pending_matches WHERE id = {pendingMatchId} FOR UPDATE")
            .AsTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (pendingMatch is null
            || pendingMatch.Status != AcceptanceStatus.Pending
            || pendingMatch.ExpiresAt.AddSeconds(1) >= DateTimeOffset.UtcNow)
        {
            return false;
        }

        var acceptances = await dbContext.PendingMatchAcceptances
            .FromSqlInterpolated($"SELECT * FROM pending_match_acceptances WHERE pending_match_id = {pendingMatchId} FOR UPDATE")
            .AsTracking()
            .ToListAsync(cancellationToken);

        var nonAcceptedPlayerIds = acceptances
            .Where(a => a.Status != AcceptanceStatus.Accepted)
            .Select(a => a.LeaguePlayerId)
            .ToList();

        if (nonAcceptedPlayerIds.Count == 0)
        {
            return false;
        }

        pendingMatch.Status = AcceptanceStatus.Declined;

        var queueEntriesToRemove = await dbContext.QueueEntries
            .Where(q => q.LeagueId == pendingMatch.LeagueId && nonAcceptedPlayerIds.Contains(q.LeaguePlayerId))
            .ToListAsync(cancellationToken);

        dbContext.QueueEntries.RemoveRange(queueEntriesToRemove);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return true;
    }

    private async Task<int> CreatePendingMatchesAsync(CancellationToken cancellationToken)
    {
        var candidateLeagues = await dbContext.Leagues
            .AsNoTracking()
            .Where(l => !dbContext.V3PendingMatches.Any(pm => pm.LeagueId == l.Id && pm.Status == AcceptanceStatus.Pending))
            .Where(l => dbContext.QueueEntries.Count(q => q.LeagueId == l.Id) >= l.QueueSize)
            .Select(l => new PendingMatchLeagueCandidate(l.OrganizationId, l.Id, l.QueueSize))
            .ToListAsync(cancellationToken);

        var createdCount = 0;
        foreach (var candidate in candidateLeagues)
        {
            if (await TryCreatePendingMatchAsync(candidate.OrganizationId, candidate.LeagueId, candidate.QueueSize, cancellationToken))
            {
                createdCount++;
            }
        }

        return createdCount;
    }

    private async Task<bool> TryCreatePendingMatchAsync(
        Guid orgId,
        Guid leagueId,
        int queueSize,
        CancellationToken cancellationToken)
    {
        var hasPendingMatch = await dbContext.V3PendingMatches
            .AnyAsync(pm => pm.LeagueId == leagueId && pm.Status == AcceptanceStatus.Pending, cancellationToken);

        if (hasPendingMatch)
        {
            return false;
        }

        var queueEntries = await dbContext.QueueEntries
            .Where(q => q.LeagueId == leagueId)
            .Include(q => q.LeaguePlayer)
            .OrderBy(q => q.JoinedAt)
            .Take(queueSize)
            .ToListAsync(cancellationToken);

        if (queueEntries.Count < queueSize)
        {
            return false;
        }

        var players = queueEntries.Select(e => e.LeaguePlayer).ToList();

        var pendingMatch = new V3PendingMatch
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            Status = AcceptanceStatus.Pending,
            ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(31),
            Teams = BalanceTeams(players, orgId, leagueId),
            Acceptances = players.Select(p => new PendingMatchAcceptance
            {
                PendingMatchId = default,
                LeaguePlayerId = p.Id,
                Status = AcceptanceStatus.Pending
            }).ToList()
        };

        dbContext.V3PendingMatches.Add(pendingMatch);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           {
                                               SqlState: PostgresErrorCodes.UniqueViolation,
                                               ConstraintName: PendingMatchIndexName
                                           })
        {
            dbContext.ChangeTracker.Clear();
            logger.LogDebug("Pending match already exists for league {LeagueId}", leagueId);
            return false;
        }
    }

    private static List<PendingMatchTeam> BalanceTeams(List<LeaguePlayer> players, Guid orgId, Guid leagueId)
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

        return teamPlayers.Select((teamPlayersForIndex, index) => new PendingMatchTeam
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            Index = index,
            Players = teamPlayersForIndex.Select((player, playerIndex) => new PendingMatchTeamPlayer
            {
                LeaguePlayerId = player.Id,
                Index = playerIndex
            }).ToList()
        }).ToList();
    }

    private sealed record PendingMatchLeagueCandidate(Guid OrganizationId, Guid LeagueId, int QueueSize);
}
