using Microsoft.EntityFrameworkCore;
using Npgsql;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Extensions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface IV3MatchMakingService
{
    Task AddPlayerToQueueAsync(Guid orgId, Guid leagueId);
    Task RemovePlayerFromQueueAsync(Guid orgId, Guid leagueId);
    Task<QueueStatusResponse> GetQueueStatusAsync(Guid orgId, Guid leagueId);
    Task<PendingMatchResponse> GetPendingMatchStatusAsync(Guid orgId, Guid leagueId, Guid pendingMatchId);
    Task AcceptPendingMatchAsync(Guid orgId, Guid leagueId, Guid pendingMatchId);
    Task DeclinePendingMatchAsync(Guid orgId, Guid leagueId, Guid pendingMatchId);
    Task<IEnumerable<ActiveMatchResponse>> GetActiveMatchesAsync(Guid orgId, Guid leagueId);
    Task CancelActiveMatchAsync(Guid orgId, Guid leagueId, Guid activeMatchId);
    Task<MatchResponse> SubmitActiveMatchResultAsync(Guid orgId, Guid leagueId, Guid activeMatchId,
        SubmitActiveMatchResultRequest request);
}

public class V3MatchMakingService(
    ILogger<V3MatchMakingService> logger,
    IUserContextResolver userContextResolver,
    ApiDbContext dbContext,
    IV3MatchesService matchesService,
    IOrganizationService organizationService
) : IV3MatchMakingService
{
    private const string QueueEntryIndexName = "ix_queue_entries_league_player";

    public async Task AddPlayerToQueueAsync(Guid orgId, Guid leagueId)
    {
        var leaguePlayer = await GetCurrentLeaguePlayerAsync(orgId, leagueId);

        var existingEntry = await dbContext.QueueEntries
            .FirstOrDefaultAsync(q => q.LeagueId == leagueId && q.LeaguePlayerId == leaguePlayer.Id);

        if (existingEntry is not null)
        {
            logger.LogInformation("Player {LeaguePlayerId} already in queue for league {LeagueId}",
                leaguePlayer.Id, leagueId);
            return;
        }

        var pendingMatch = await dbContext.V3PendingMatches
            .Where(pm => pm.LeagueId == leagueId && pm.Status == AcceptanceStatus.Pending)
            .Where(pm => pm.Acceptances.Any(a => a.LeaguePlayerId == leaguePlayer.Id))
            .FirstOrDefaultAsync();

        if (pendingMatch is not null)
        {
            throw new InvalidArgumentException("You have an active pending match");
        }

        var activeMatch = await dbContext.V3ActiveMatches
            .Where(am => am.LeagueId == leagueId)
            .Where(am => am.PendingMatch.Teams.Any(t => t.Players.Any(p => p.LeaguePlayerId == leaguePlayer.Id)))
            .FirstOrDefaultAsync();

        if (activeMatch is not null)
        {
            throw new InvalidArgumentException("You have an active match in progress");
        }

        var queueEntry = new QueueEntry
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            LeaguePlayerId = leaguePlayer.Id,
            JoinedAt = DateTimeOffset.UtcNow
        };

        dbContext.QueueEntries.Add(queueEntry);
        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           {
                                               SqlState: PostgresErrorCodes.UniqueViolation,
                                               ConstraintName: QueueEntryIndexName
                                           })
        {
            dbContext.Entry(queueEntry).State = EntityState.Detached;
            logger.LogInformation("Player {LeaguePlayerId} already in queue for league {LeagueId}",
                leaguePlayer.Id, leagueId);
        }
    }

    public async Task RemovePlayerFromQueueAsync(Guid orgId, Guid leagueId)
    {
        var leaguePlayer = await GetCurrentLeaguePlayerAsync(orgId, leagueId);

        var queueEntry = await dbContext.QueueEntries
            .FirstOrDefaultAsync(q => q.LeagueId == leagueId && q.LeaguePlayerId == leaguePlayer.Id);

        if (queueEntry is null)
        {
            return;
        }

        dbContext.QueueEntries.Remove(queueEntry);
        await dbContext.SaveChangesAsync();
    }

    public async Task<QueueStatusResponse> GetQueueStatusAsync(Guid orgId, Guid leagueId)
    {
        var leaguePlayer = await GetCurrentLeaguePlayerAsync(orgId, leagueId);

        var queueEntries = await dbContext.QueueEntries
            .Where(q => q.LeagueId == leagueId)
            .Include(q => q.LeaguePlayer)
                .ThenInclude(lp => lp.OrganizationMembership)
                    .ThenInclude(om => om.User)
            .OrderBy(q => q.JoinedAt)
            .ToListAsync();

        var queuedPlayers = queueEntries.Select(q => new QueuedPlayerResponse
        {
            LeaguePlayerId = q.LeaguePlayerId,
            DisplayName = q.LeaguePlayer.OrganizationMembership.GetDisplayName(),
            Username = q.LeaguePlayer.OrganizationMembership.GetUsername(),
            JoinedAt = q.JoinedAt
        }).ToList();

        var pendingMatch = await dbContext.V3PendingMatches
            .Where(pm => pm.LeagueId == leagueId && pm.Status == AcceptanceStatus.Pending)
            .Where(pm => pm.Acceptances.Any(a => a.LeaguePlayerId == leaguePlayer.Id))
            .Include(pm => pm.Teams)
            .ThenInclude(t => t.Players)
            .ThenInclude(p => p.LeaguePlayer)
            .ThenInclude(lp => lp.OrganizationMembership)
            .ThenInclude(om => om.User)
            .Include(pm => pm.Acceptances)
            .FirstOrDefaultAsync();

        var activeMatch = await dbContext.V3ActiveMatches
            .Where(am => am.LeagueId == leagueId)
            .Where(am => am.PendingMatch.Teams.Any(t => t.Players.Any(p => p.LeaguePlayerId == leaguePlayer.Id)))
            .Include(am => am.PendingMatch)
            .ThenInclude(pm => pm.Teams)
            .ThenInclude(t => t.Players)
            .ThenInclude(p => p.LeaguePlayer)
            .ThenInclude(lp => lp.OrganizationMembership)
            .ThenInclude(om => om.User)
            .FirstOrDefaultAsync();

        return new QueueStatusResponse
        {
            QueuedPlayers = queuedPlayers,
            PendingMatch = pendingMatch is not null ? MapPendingMatch(pendingMatch) : null,
            ActiveMatch = activeMatch is not null ? MapActiveMatch(activeMatch) : null
        };
    }

    public async Task<PendingMatchResponse> GetPendingMatchStatusAsync(Guid orgId, Guid leagueId,
        Guid pendingMatchId)
    {
        var leaguePlayer = await GetCurrentLeaguePlayerAsync(orgId, leagueId);

        var pendingMatch = await dbContext.V3PendingMatches
            .Where(pm => pm.Id == pendingMatchId && pm.LeagueId == leagueId)
            .Where(pm => pm.Acceptances.Any(a => a.LeaguePlayerId == leaguePlayer.Id))
            .Include(pm => pm.Teams)
            .ThenInclude(t => t.Players)
            .ThenInclude(p => p.LeaguePlayer)
            .ThenInclude(lp => lp.OrganizationMembership)
            .ThenInclude(om => om.User)
            .Include(pm => pm.Acceptances)
            .FirstOrDefaultAsync();

        if (pendingMatch is null)
        {
            throw new NotFoundException("Pending match not found");
        }

        return MapPendingMatch(pendingMatch);
    }

    public async Task AcceptPendingMatchAsync(Guid orgId, Guid leagueId, Guid pendingMatchId)
    {
        var leaguePlayer = await GetCurrentLeaguePlayerAsync(orgId, leagueId);

        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var pendingMatch = await GetPendingMatchForUpdateAsync(pendingMatchId, leagueId, includeTeams: true);

        if (pendingMatch is null)
        {
            throw new NotFoundException("Pending match not found");
        }

        if (pendingMatch.Status != AcceptanceStatus.Pending)
        {
            throw new InvalidArgumentException("Pending match is not in pending state");
        }

        var acceptance = pendingMatch.Acceptances
            .FirstOrDefault(a => a.LeaguePlayerId == leaguePlayer.Id);

        if (acceptance is null)
        {
            throw new InvalidArgumentException("You are not part of this match");
        }

        if (acceptance.Status != AcceptanceStatus.Pending)
        {
            throw new InvalidArgumentException("You have already responded to this match");
        }

        acceptance.Status = AcceptanceStatus.Accepted;
        acceptance.AcceptedAt = DateTimeOffset.UtcNow;

        if (pendingMatch.Acceptances.All(a => a.Status == AcceptanceStatus.Accepted))
        {
            pendingMatch.Status = AcceptanceStatus.Accepted;
            await PromotePendingMatchToActiveMatch(orgId, pendingMatch);
        }

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task DeclinePendingMatchAsync(Guid orgId, Guid leagueId, Guid pendingMatchId)
    {
        var leaguePlayer = await GetCurrentLeaguePlayerAsync(orgId, leagueId);

        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var pendingMatch = await GetPendingMatchForUpdateAsync(pendingMatchId, leagueId, includeTeams: false);

        if (pendingMatch is null)
        {
            throw new NotFoundException("Pending match not found");
        }

        if (pendingMatch.Status != AcceptanceStatus.Pending)
        {
            throw new InvalidArgumentException("Pending match is not in pending state");
        }

        var acceptance = pendingMatch.Acceptances
            .FirstOrDefault(a => a.LeaguePlayerId == leaguePlayer.Id);

        if (acceptance is null)
        {
            throw new InvalidArgumentException("You are not part of this match");
        }

        acceptance.Status = AcceptanceStatus.Declined;
        pendingMatch.Status = AcceptanceStatus.Declined;

        var nonDecliningPlayerIds = pendingMatch.Acceptances
            .Where(a => a.LeaguePlayerId != leaguePlayer.Id)
            .Select(a => a.LeaguePlayerId)
            .ToList();

        var queueEntriesToRemove = await dbContext.QueueEntries
            .Where(q => q.LeagueId == leagueId && nonDecliningPlayerIds.Contains(q.LeaguePlayerId))
            .ToListAsync();

        dbContext.QueueEntries.RemoveRange(queueEntriesToRemove);

        var declinerQueueEntry = await dbContext.QueueEntries
            .FirstOrDefaultAsync(q => q.LeagueId == leagueId && q.LeaguePlayerId == leaguePlayer.Id);

        if (declinerQueueEntry is not null)
        {
            dbContext.QueueEntries.Remove(declinerQueueEntry);
        }

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task<IEnumerable<ActiveMatchResponse>> GetActiveMatchesAsync(Guid orgId, Guid leagueId)
    {
        var activeMatches = await dbContext.V3ActiveMatches
            .Where(am => am.LeagueId == leagueId)
            .Include(am => am.PendingMatch)
            .ThenInclude(pm => pm.Teams)
            .ThenInclude(t => t.Players)
            .ThenInclude(p => p.LeaguePlayer)
            .ThenInclude(lp => lp.OrganizationMembership)
            .ThenInclude(om => om.User)
            .OrderByDescending(am => am.StartedAt)
            .ToListAsync();

        return activeMatches.Select(MapActiveMatch);
    }

    public async Task CancelActiveMatchAsync(Guid orgId, Guid leagueId, Guid activeMatchId)
    {
        var activeMatch = await dbContext.V3ActiveMatches
            .Where(am => am.Id == activeMatchId && am.LeagueId == leagueId)
            .Include(am => am.PendingMatch)
            .ThenInclude(pm => pm.Teams)
            .ThenInclude(t => t.Players)
            .Include(am => am.PendingMatch)
            .ThenInclude(pm => pm.Acceptances)
            .FirstOrDefaultAsync();

        if (activeMatch is null)
        {
            throw new NotFoundException("Active match not found");
        }

        await EnsureCanMutateActiveMatchAsync(orgId, leagueId, activeMatch);

        RemoveActiveMatch(activeMatch);
        await dbContext.SaveChangesAsync();
    }

    public async Task<MatchResponse> SubmitActiveMatchResultAsync(Guid orgId, Guid leagueId, Guid activeMatchId,
        SubmitActiveMatchResultRequest request)
    {
        var activeMatch = await dbContext.V3ActiveMatches
            .Where(am => am.Id == activeMatchId && am.LeagueId == leagueId)
            .Include(am => am.PendingMatch)
            .ThenInclude(pm => pm.Teams)
            .ThenInclude(t => t.Players)
            .Include(am => am.PendingMatch)
            .ThenInclude(pm => pm.Acceptances)
            .FirstOrDefaultAsync();

        if (activeMatch is null)
        {
            throw new NotFoundException("Active match not found");
        }

        await EnsureCanMutateActiveMatchAsync(orgId, leagueId, activeMatch);

        var submitRequest = new SubmitMatchRequest
        {
            Teams = request.Teams.Select(t =>
            {
                var pendingTeam = activeMatch.PendingMatch.Teams
                    .FirstOrDefault(pt => pt.Index == t.TeamIndex);

                if (pendingTeam is null)
                {
                    throw new InvalidArgumentException($"Team index {t.TeamIndex} not found");
                }

                return new SubmitMatchTeamRequest
                {
                    Players = pendingTeam.Players
                        .OrderBy(p => p.Index)
                        .Select(p => new SubmitMatchPlayerRequest { LeaguePlayerId = p.LeaguePlayerId })
                        .ToList(),
                    Score = t.Score
                };
            }).ToList()
        };

        var matchResponse = await matchesService.SubmitMatchAsync(orgId, leagueId, submitRequest,
            MatchSource.Matchmaking);

        RemoveActiveMatch(activeMatch);
        await dbContext.SaveChangesAsync();

        return matchResponse;
    }

    private async Task PromotePendingMatchToActiveMatch(Guid orgId, V3PendingMatch pendingMatch)
    {
        var activeMatch = new V3ActiveMatch
        {
            OrganizationId = orgId,
            LeagueId = pendingMatch.LeagueId,
            PendingMatchId = pendingMatch.Id,
            StartedAt = DateTimeOffset.UtcNow
        };

        dbContext.V3ActiveMatches.Add(activeMatch);

        var playerIds = pendingMatch.Teams
            .SelectMany(t => t.Players)
            .Select(p => p.LeaguePlayerId)
            .ToList();

        var queueEntries = await dbContext.QueueEntries
            .Where(q => q.LeagueId == pendingMatch.LeagueId && playerIds.Contains(q.LeaguePlayerId))
            .ToListAsync();

        dbContext.QueueEntries.RemoveRange(queueEntries);
    }

    private async Task<V3PendingMatch?> GetPendingMatchForUpdateAsync(
        Guid pendingMatchId,
        Guid leagueId,
        bool includeTeams)
    {
        var pendingMatch = await dbContext.V3PendingMatches
            .FromSqlInterpolated($"SELECT * FROM pending_matches WHERE id = {pendingMatchId} AND league_id = {leagueId} FOR UPDATE")
            .AsTracking()
            .FirstOrDefaultAsync();

        if (pendingMatch is null)
        {
            return null;
        }

        pendingMatch.Acceptances = await dbContext.PendingMatchAcceptances
            .FromSqlInterpolated($"SELECT * FROM pending_match_acceptances WHERE pending_match_id = {pendingMatchId} FOR UPDATE")
            .AsTracking()
            .ToListAsync();

        if (includeTeams)
        {
            await dbContext.Entry(pendingMatch)
                .Collection(pm => pm.Teams)
                .Query()
                .Include(t => t.Players)
                .LoadAsync();
        }

        return pendingMatch;
    }

    private void RemoveActiveMatch(V3ActiveMatch activeMatch)
    {
        var pendingMatch = activeMatch.PendingMatch;

        foreach (var team in pendingMatch.Teams)
        {
            dbContext.PendingMatchTeamPlayers.RemoveRange(team.Players);
        }

        dbContext.PendingMatchTeams.RemoveRange(pendingMatch.Teams);
        dbContext.PendingMatchAcceptances.RemoveRange(pendingMatch.Acceptances);
        dbContext.V3ActiveMatches.Remove(activeMatch);
        dbContext.V3PendingMatches.Remove(pendingMatch);
    }

    private async Task<LeaguePlayer> GetCurrentLeaguePlayerAsync(Guid orgId, Guid leagueId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var leaguePlayer = await dbContext.LeaguePlayers
            .Include(lp => lp.OrganizationMembership)
            .ThenInclude(om => om.User)
            .Where(lp => lp.OrganizationId == orgId && lp.LeagueId == leagueId)
            .Where(lp => lp.OrganizationMembership.User != null &&
                         lp.OrganizationMembership.User.IdentityUserId == identityUserId)
            .FirstOrDefaultAsync();

        if (leaguePlayer is null)
        {
            throw new NotFoundException("You are not a member of this league");
        }

        return leaguePlayer;
    }

    private async Task EnsureCanMutateActiveMatchAsync(Guid orgId, Guid leagueId, V3ActiveMatch activeMatch)
    {
        var currentMembership = await organizationService.GetMembershipForCurrentUserAsync(orgId)
            ?? throw new ForbiddenException("You are not a member of this organization");

        if (currentMembership.Role <= OrganizationRole.Moderator)
        {
            return;
        }

        var playerIds = activeMatch.PendingMatch.Teams
            .SelectMany(t => t.Players)
            .Select(p => p.LeaguePlayerId)
            .ToList();

        var isParticipant = await dbContext.LeaguePlayers
            .AnyAsync(lp => lp.OrganizationMembershipId == currentMembership.Id
                            && lp.LeagueId == leagueId
                            && playerIds.Contains(lp.Id));

        if (!isParticipant)
            throw new ForbiddenException("You are not allowed to modify this active match");
    }

    private static PendingMatchResponse MapPendingMatch(V3PendingMatch pm) => new()
    {
        Id = pm.Id,
        Status = pm.Status,
        ExpiresAt = pm.ExpiresAt,
        Teams = pm.Teams.OrderBy(t => t.Index).Select(t => new PendingMatchTeamResponse
        {
            Index = t.Index,
            Players = t.Players.OrderBy(p => p.Index).Select(p => new PendingMatchTeamPlayerResponse
            {
                LeaguePlayerId = p.LeaguePlayerId,
                DisplayName = p.LeaguePlayer.OrganizationMembership.GetDisplayName(),
                Username = p.LeaguePlayer.OrganizationMembership.GetUsername(),
                Index = p.Index
            }).ToList()
        }).ToList(),
        Acceptances = pm.Acceptances.Select(a => new PendingMatchAcceptanceResponse
        {
            LeaguePlayerId = a.LeaguePlayerId,
            Status = a.Status,
            AcceptedAt = a.AcceptedAt
        }).ToList()
    };

    private static ActiveMatchResponse MapActiveMatch(V3ActiveMatch am) => new()
    {
        Id = am.Id,
        PendingMatchId = am.PendingMatchId,
        StartedAt = am.StartedAt,
        Teams = am.PendingMatch.Teams.OrderBy(t => t.Index).Select(t => new PendingMatchTeamResponse
        {
            Index = t.Index,
            Players = t.Players.OrderBy(p => p.Index).Select(p => new PendingMatchTeamPlayerResponse
            {
                LeaguePlayerId = p.LeaguePlayerId,
                DisplayName = p.LeaguePlayer.OrganizationMembership.GetDisplayName(),
                Username = p.LeaguePlayer.OrganizationMembership.GetUsername(),
                Index = p.Index
            }).ToList()
        }).ToList()
    };
}
