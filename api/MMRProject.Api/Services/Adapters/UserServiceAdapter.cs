using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Services.V3;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.Adapters;

public class UserServiceAdapter(
    ILegacyContextResolver contextResolver,
    ILegacyIdResolver idResolver,
    IV3UserService userService,
    IOrganizationService organizationService,
    ILeaguePlayerService leaguePlayerService,
    IUserContextResolver userContextResolver,
    ApiDbContext dbContext) : IUserService
{
    public async Task<List<Player>> AllUsersAsync(string? searchQuery = default)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var players = await leaguePlayerService.GetLeaguePlayersAsync(orgId, leagueId);

        var result = new List<Player>();
        foreach (var p in players)
        {
            long legacyId;
            try
            {
                legacyId = await idResolver.ResolveLegacyPlayerIdAsync(p.Id);
            }
            catch
            {
                continue;
            }

            var player = MapToLegacyPlayer(p, legacyId);

            if (!string.IsNullOrWhiteSpace(searchQuery))
            {
                var pattern = searchQuery.ToLowerInvariant();
                var nameMatch = player.Name?.ToLowerInvariant().Contains(pattern) == true;
                var displayNameMatch = player.DisplayName?.ToLowerInvariant().Contains(pattern) == true;
                if (!nameMatch && !displayNameMatch) continue;
            }

            result.Add(player);
        }

        return result;
    }

    public async Task<Player> CreateUserAsync(string name, string? displayName)
    {
        // In v3, users are created through organization membership
        throw new NotSupportedException("Direct user creation is not supported through the legacy adapter. Use organization invites instead.");
    }

    public async Task<Player?> GetUserAsync(long userId)
    {
        Guid v3Id;
        try
        {
            v3Id = await idResolver.ResolvePlayerIdAsync(userId);
        }
        catch
        {
            return null;
        }

        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();

        try
        {
            var player = await leaguePlayerService.GetLeaguePlayerAsync(orgId, leagueId, v3Id);
            return MapToLegacyPlayer(player, userId);
        }
        catch (NotFoundException)
        {
            return null;
        }
    }

    public async Task<Player?> GetCurrentAuthenticatedUserAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var me = await leaguePlayerService.GetMeAsync(orgId, leagueId);

        if (me == null)
            return null;

        long legacyId;
        try
        {
            legacyId = await idResolver.ResolveLegacyPlayerIdAsync(me.Id);
        }
        catch
        {
            return null;
        }

        var identityUserId = userContextResolver.GetIdentityUserId();
        var email = userContextResolver.GetEmail();
        var player = MapToLegacyPlayer(me, legacyId);
        player.IdentityUserId = identityUserId;
        player.Email = email;
        return player;
    }

    public async Task<Player> ClaimUserForCurrentAuthenticatedUserAsync(long userId)
    {
        // In v3, claiming is handled through organization membership
        throw new NotSupportedException("User claiming is not supported through the legacy adapter");
    }

    public async Task<Player> UpdateUserAsync(long userId, string? name, string? displayName, PlayerRole? role = null)
    {
        // Not directly supported through v3 adapter
        throw new NotSupportedException("User updates are not supported through the legacy adapter");
    }

    public async Task<(PlayerHistory history, long seasonId)?> LatestPlayerHistoryAsync(long userId)
    {
        var v3PlayerId = await idResolver.ResolvePlayerIdAsync(userId);

        var ratingHistory = await dbContext.RatingHistories
            .Include(rh => rh.Match)
            .Where(rh => rh.LeaguePlayerId == v3PlayerId)
            .OrderByDescending(rh => rh.Match.PlayedAt)
            .FirstOrDefaultAsync();

        if (ratingHistory == null)
            return null;

        long legacySeasonId;
        try
        {
            legacySeasonId = await idResolver.ResolveLegacySeasonIdAsync(ratingHistory.Match.SeasonId);
        }
        catch
        {
            return null;
        }

        return (new PlayerHistory
        {
            PlayerId = userId,
            Mmr = ratingHistory.Mmr,
            Mu = ratingHistory.Mu,
            Sigma = ratingHistory.Sigma,
            MatchId = ratingHistory.Match.LegacyMatchId,
        }, legacySeasonId);
    }

    public async Task<List<(PlayerHistory history, long seasonId)>> LatestPlayerHistoriesAsync(List<long> userIds)
    {
        var results = new List<(PlayerHistory, long)>();
        foreach (var userId in userIds)
        {
            var result = await LatestPlayerHistoryAsync(userId);
            if (result.HasValue)
                results.Add(result.Value);
        }

        return results;
    }

    private static Player MapToLegacyPlayer(DTOs.V3.LeaguePlayerResponse p, long legacyId)
    {
        return new Player
        {
            Id = legacyId,
            Name = p.Username ?? p.DisplayName ?? $"Player {legacyId}",
            DisplayName = p.DisplayName,
            Mmr = p.Mmr,
            Mu = p.Mu,
            Sigma = p.Sigma,
            CreatedAt = p.CreatedAt.UtcDateTime,
        };
    }
}
