using MMRProject.Api.Data.Entities;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;
using V3CreateMatchFlagRequest = MMRProject.Api.DTOs.V3.CreateMatchFlagRequest;
using MatchFlagStatus = MMRProject.Api.Data.Entities.MatchFlagStatus;
using V3MatchFlagStatus = MMRProject.Api.Data.Entities.V3.MatchFlagStatus;

namespace MMRProject.Api.Services.Adapters;

public class MatchFlagServiceAdapter(
    ILegacyContextResolver contextResolver,
    ILegacyIdResolver idResolver,
    IV3MatchFlagService matchFlagService) : IMatchFlagService
{
    public async Task<MatchFlag> CreateFlagAsync(long matchId, long playerId, string reason)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var v3MatchId = await idResolver.ResolveMatchIdAsync(matchId);

        var response = await matchFlagService.CreateFlagAsync(orgId, leagueId, new V3CreateMatchFlagRequest
        {
            MatchId = v3MatchId,
            Reason = reason,
        });

        return MapToLegacyFlag(response, matchId);
    }

    public async Task<List<MatchFlagDetails>> GetPendingFlagsAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var flags = await matchFlagService.GetFlagsAsync(orgId, leagueId, V3MatchFlagStatus.Open);

        // Cannot map to MatchFlagDetails (requires full match data) in adapter
        throw new NotSupportedException("GetPendingFlagsAsync with full match details is not supported through the legacy adapter");
    }

    public async Task<MatchFlag> ResolveFlagAsync(long flagId, long resolvedById, string? note)
    {
        // V1 flagId is a long but v3 uses Guid - this adapter cannot resolve legacy flag IDs
        throw new NotSupportedException("ResolveFlagAsync is not supported through the legacy adapter");
    }

    public async Task<List<MatchFlag>> GetUserPendingFlagsAsync(long playerId)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var flags = await matchFlagService.GetMyFlagsAsync(orgId, leagueId);

        var result = new List<MatchFlag>();
        foreach (var f in flags)
        {
            try
            {
                var legacyMatchId = await idResolver.ResolveLegacyMatchIdAsync(f.MatchId);
                result.Add(MapToLegacyFlag(f, legacyMatchId));
            }
            catch
            {
                // Skip flags for matches without legacy IDs
            }
        }

        return result;
    }

    public async Task<MatchFlag> UpdateFlagReasonAsync(long flagId, long playerId, string newReason)
    {
        // V1 flagId is a long but v3 uses Guid - this adapter cannot resolve legacy flag IDs
        throw new NotSupportedException("UpdateFlagReasonAsync is not supported through the legacy adapter");
    }

    public async Task DeleteFlagAsync(long flagId, long playerId)
    {
        // V1 flagId is a long but v3 uses Guid - this adapter cannot resolve legacy flag IDs
        throw new NotSupportedException("DeleteFlagAsync is not supported through the legacy adapter");
    }

    private static MatchFlag MapToLegacyFlag(MatchFlagResponse response, long legacyMatchId)
    {
        return new MatchFlag
        {
            MatchId = legacyMatchId,
            Reason = response.Reason,
            Status = response.Status == V3MatchFlagStatus.Open ? MatchFlagStatus.Pending : MatchFlagStatus.Resolved,
            CreatedAt = response.CreatedAt.UtcDateTime,
            UpdatedAt = response.UpdatedAt.UtcDateTime,
            ResolutionNote = response.ResolutionNote,
            ResolvedAt = response.ResolvedAt?.UtcDateTime,
        };
    }
}
