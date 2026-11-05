using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Services.V3;

/// <summary>
/// Serialises every change that commits a league player to a queue entry, game
/// invite, pending match or active match. Callers must take it inside the
/// transaction that performs the check and the write, so checks cannot interleave.
/// </summary>
internal static class LeagueCommitmentLock
{
    public static Task AcquireAsync(ApiDbContext dbContext, Guid leagueId, CancellationToken cancellationToken = default)
    {
        // Transaction-scoped advisory lock: released automatically at commit or rollback.
        var key = $"league-commitments:{leagueId}";
        return dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtext({key}))", cancellationToken);
    }

    /// <summary>
    /// Returns what currently holds the player in this league, or null when they are free.
    /// Caller must hold <see cref="AcquireAsync"/>.
    /// </summary>
    public static async Task<LeagueCommitment?> FindAsync(
        ApiDbContext dbContext,
        Guid leagueId,
        Guid leaguePlayerId,
        CancellationToken cancellationToken = default)
    {
        if (await dbContext.QueueEntries.AnyAsync(q => q.LeagueId == leagueId && q.LeaguePlayerId == leaguePlayerId, cancellationToken))
        {
            return LeagueCommitment.Queue;
        }

        if (await dbContext.V3PendingMatches.AnyAsync(pm => pm.LeagueId == leagueId
                && pm.Status == AcceptanceStatus.Pending
                && pm.Acceptances.Any(a => a.LeaguePlayerId == leaguePlayerId), cancellationToken))
        {
            return LeagueCommitment.PendingMatch;
        }

        if (await dbContext.V3ActiveMatches.AnyAsync(am => am.LeagueId == leagueId
                && am.PendingMatch.Teams.Any(t => t.Players.Any(p => p.LeaguePlayerId == leaguePlayerId)), cancellationToken))
        {
            return LeagueCommitment.ActiveMatch;
        }

        if (await dbContext.GameInviteParticipants.AnyAsync(p => p.LeagueId == leagueId && p.LeaguePlayerId == leaguePlayerId, cancellationToken))
        {
            return LeagueCommitment.GameInvite;
        }

        return null;
    }
}

internal enum LeagueCommitment
{
    Queue,
    PendingMatch,
    ActiveMatch,
    GameInvite
}
