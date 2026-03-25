using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface ILeaguePlayerService
{
    Task<LeaguePlayerResponse> JoinLeagueAsync(Guid orgId, Guid leagueId);
    Task<List<LeaguePlayerResponse>> GetLeaguePlayersAsync(Guid orgId, Guid leagueId);
    Task<LeaguePlayerResponse> GetLeaguePlayerAsync(Guid orgId, Guid leagueId, Guid playerId);
    Task<LeaguePlayerResponse?> GetMeAsync(Guid orgId, Guid leagueId);
}

public class LeaguePlayerService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver) : ILeaguePlayerService
{
    public async Task<LeaguePlayerResponse> JoinLeagueAsync(Guid orgId, Guid leagueId)
    {
        var league = await dbContext.Leagues
            .FirstOrDefaultAsync(l => l.Id == leagueId && l.OrganizationId == orgId)
            ?? throw new NotFoundException($"League with ID '{leagueId}' not found");

        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId)
            ?? throw new NotFoundException("User not found");

        var membership = await dbContext.OrganizationMemberships
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId
                                      && m.UserId == user.Id
                                      && m.Status == MembershipStatus.Active)
            ?? throw new ForbiddenException("You are not an active member of this organization");

        var existingPlayer = await dbContext.LeaguePlayers
            .FirstOrDefaultAsync(lp => lp.LeagueId == leagueId
                                       && lp.OrganizationMembershipId == membership.Id);

        if (existingPlayer != null)
            throw new InvalidArgumentException("You have already joined this league");

        var leaguePlayer = new LeaguePlayer
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            OrganizationMembershipId = membership.Id,
            Mmr = 1500,
            Mu = 25.0m,
            Sigma = 8.333m
        };

        dbContext.LeaguePlayers.Add(leaguePlayer);
        await dbContext.SaveChangesAsync();

        return MapToResponse(leaguePlayer, membership);
    }

    public async Task<List<LeaguePlayerResponse>> GetLeaguePlayersAsync(Guid orgId, Guid leagueId)
    {
        var players = await dbContext.LeaguePlayers
            .AsNoTracking()
            .Include(lp => lp.OrganizationMembership)
            .ThenInclude(m => m.User)
            .Where(lp => lp.LeagueId == leagueId && lp.OrganizationId == orgId)
            .ToListAsync();

        return players.Select(lp => MapToResponse(lp, lp.OrganizationMembership)).ToList();
    }

    public async Task<LeaguePlayerResponse> GetLeaguePlayerAsync(Guid orgId, Guid leagueId, Guid playerId)
    {
        var player = await dbContext.LeaguePlayers
            .Include(lp => lp.OrganizationMembership)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(lp => lp.Id == playerId
                                       && lp.LeagueId == leagueId
                                       && lp.OrganizationId == orgId)
            ?? throw new NotFoundException($"League player with ID '{playerId}' not found");

        return MapToResponse(player, player.OrganizationMembership);
    }

    public async Task<LeaguePlayerResponse?> GetMeAsync(Guid orgId, Guid leagueId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var player = await dbContext.LeaguePlayers
            .Include(lp => lp.OrganizationMembership)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(lp => lp.OrganizationId == orgId
                                       && lp.LeagueId == leagueId
                                       && lp.OrganizationMembership.User!.IdentityUserId == identityUserId
                                       && lp.OrganizationMembership.Status == MembershipStatus.Active);

        return player == null ? null : MapToResponse(player, player.OrganizationMembership);
    }

    private static LeaguePlayerResponse MapToResponse(LeaguePlayer player, OrganizationMembership membership)
    {
        return new LeaguePlayerResponse
        {
            Id = player.Id,
            OrganizationMembershipId = player.OrganizationMembershipId,
            DisplayName = membership.DisplayName ?? membership.User?.DisplayName,
            Username = membership.Username ?? membership.User?.Username,
            Mmr = player.Mmr,
            Mu = player.Mu,
            Sigma = player.Sigma,
            CreatedAt = player.CreatedAt
        };
    }
}
