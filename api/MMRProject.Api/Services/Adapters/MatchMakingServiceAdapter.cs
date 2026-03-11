using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Services.Adapters;

public class MatchMakingServiceAdapter(
    ILegacyContextResolver contextResolver,
    ILegacyIdResolver idResolver,
    IV3MatchMakingService matchMakingService) : IMatchMakingService
{
    public async Task AddPlayerToQueueAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        await matchMakingService.AddPlayerToQueueAsync(orgId, leagueId);
    }

    public async Task RemovePlayerFromQueueAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        await matchMakingService.RemovePlayerFromQueueAsync(orgId, leagueId);
    }

    public async Task<MatchMakingQueueStatus> MatchMakingQueueStatusAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var status = await matchMakingService.GetQueueStatusAsync(orgId, leagueId);

        MatchMakingQueueStatusPendingMatch? pendingMatch = null;
        ActiveMatchDto? activeMatch = null;

        if (status.PendingMatch != null)
        {
            pendingMatch = new MatchMakingQueueStatusPendingMatch
            {
                Id = status.PendingMatch.Id,
                Status = MapAcceptanceStatus(status.PendingMatch.Status),
                ExpiresAt = status.PendingMatch.ExpiresAt,
            };
        }

        if (status.ActiveMatch != null)
        {
            activeMatch = await MapActiveMatch(status.ActiveMatch);
        }

        return new MatchMakingQueueStatus
        {
            IsUserInQueue = status.QueuedPlayers.Count > 0 || status.PendingMatch != null || status.ActiveMatch != null,
            PlayersInQueue = status.QueuedPlayers.Count,
            AssignedPendingMatch = pendingMatch,
            AssignedActiveMatch = activeMatch,
        };
    }

    public async Task<PendingMatchStatus> PendingMatchStatusAsync(Guid matchId)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var status = await matchMakingService.GetPendingMatchStatusAsync(orgId, leagueId, matchId);
        return MapAcceptanceStatus(status.Status);
    }

    public async Task AcceptPendingMatchAsync(Guid matchId)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        await matchMakingService.AcceptPendingMatchAsync(orgId, leagueId, matchId);
    }

    public async Task DeclinePendingMatchAsync(Guid matchId)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        await matchMakingService.DeclinePendingMatchAsync(orgId, leagueId, matchId);
    }

    public async Task<IEnumerable<ActiveMatchDto>> ActiveMatchesAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var activeMatches = await matchMakingService.GetActiveMatchesAsync(orgId, leagueId);

        var result = new List<ActiveMatchDto>();
        foreach (var am in activeMatches)
        {
            var mapped = await MapActiveMatch(am);
            if (mapped != null)
                result.Add(mapped);
        }

        return result;
    }

    public async Task CancelActiveMatchAsync(Guid matchId)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        await matchMakingService.CancelActiveMatchAsync(orgId, leagueId, matchId);
    }

    public async Task SubmitActiveMatchResultAsync(Guid matchId, ActiveMatchSubmitRequest submitRequest)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var request = new DTOs.V3.SubmitActiveMatchResultRequest
        {
            Teams =
            [
                new DTOs.V3.ActiveMatchTeamScoreRequest { TeamIndex = 0, Score = submitRequest.Team1Score },
                new DTOs.V3.ActiveMatchTeamScoreRequest { TeamIndex = 1, Score = submitRequest.Team2Score },
            ],
        };

        await matchMakingService.SubmitActiveMatchResultAsync(orgId, leagueId, matchId, request);
    }

    private async Task<ActiveMatchDto?> MapActiveMatch(DTOs.V3.ActiveMatchResponse am)
    {
        var teams = am.Teams.OrderBy(t => t.Index).ToList();
        if (teams.Count < 2) return null;

        var team1PlayerIds = new List<long>();
        var team2PlayerIds = new List<long>();

        foreach (var p in teams[0].Players)
        {
            try
            {
                team1PlayerIds.Add(await idResolver.ResolveLegacyPlayerIdAsync(p.LeaguePlayerId));
            }
            catch
            {
                // Skip players without legacy IDs
            }
        }

        foreach (var p in teams[1].Players)
        {
            try
            {
                team2PlayerIds.Add(await idResolver.ResolveLegacyPlayerIdAsync(p.LeaguePlayerId));
            }
            catch
            {
                // Skip players without legacy IDs
            }
        }

        return new ActiveMatchDto
        {
            Id = am.Id,
            CreatedAt = am.StartedAt,
            Team1 = new ActiveMatchTeamDto { PlayerIds = team1PlayerIds },
            Team2 = new ActiveMatchTeamDto { PlayerIds = team2PlayerIds },
        };
    }

    private static PendingMatchStatus MapAcceptanceStatus(Data.Entities.V3.AcceptanceStatus status)
    {
        return status switch
        {
            Data.Entities.V3.AcceptanceStatus.Pending => PendingMatchStatus.Pending,
            Data.Entities.V3.AcceptanceStatus.Accepted => PendingMatchStatus.Accepted,
            Data.Entities.V3.AcceptanceStatus.Declined => PendingMatchStatus.Declined,
            _ => PendingMatchStatus.Pending,
        };
    }
}
