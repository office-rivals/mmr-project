using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface ISessionService
{
    Task<MeResponse> GetMeAsync();
    Task<List<MeOrganizationResponse>> GetMyOrganizationsAsync();
    Task<List<MeLeagueResponse>> GetMyLeaguesAsync(Guid organizationId);
}

public class SessionService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    IV3UserService userService,
    IInviteLinkService inviteLinkService) : ISessionService
{
    public async Task<MeResponse> GetMeAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var email = userContextResolver.GetEmail()
                    ?? throw new InvalidArgumentException("Email claim is required");

        var user = await userService.EnsureUserAsync(identityUserId, email, null, null);

        await inviteLinkService.AutoClaimInvitesAsync(email, user.Id);

        var memberships = await dbContext.OrganizationMemberships
            .Include(m => m.Organization)
            .Where(m => m.UserId == user.Id && m.Status == Data.Entities.V3.MembershipStatus.Active)
            .ToListAsync();

        var orgIds = memberships.Select(m => m.OrganizationId).ToList();
        var membershipIds = memberships.Select(m => m.Id).ToList();

        var leaguePlayers = await dbContext.LeaguePlayers
            .Include(lp => lp.League)
            .Where(lp => orgIds.Contains(lp.OrganizationId)
                         && membershipIds.Contains(lp.OrganizationMembershipId))
            .ToListAsync();

        var leaguePlayersByOrg = leaguePlayers
            .GroupBy(lp => lp.OrganizationId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return new MeResponse
        {
            Id = user.Id,
            IdentityUserId = user.IdentityUserId,
            Email = user.Email,
            Username = user.Username,
            DisplayName = user.DisplayName,
            Organizations = memberships.Select(m => new MeOrganizationResponse
            {
                Id = m.Organization.Id,
                Name = m.Organization.Name,
                Slug = m.Organization.Slug,
                Role = m.Role,
                Leagues = leaguePlayersByOrg.TryGetValue(m.OrganizationId, out var lps)
                    ? lps.Select(lp => new MeLeagueResponse
                    {
                        Id = lp.League.Id,
                        Name = lp.League.Name,
                        Slug = lp.League.Slug,
                        LeaguePlayerId = lp.Id
                    }).ToList()
                    : []
            }).ToList()
        };
    }

    public async Task<List<MeOrganizationResponse>> GetMyOrganizationsAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (user == null)
            return [];

        var memberships = await dbContext.OrganizationMemberships
            .Include(m => m.Organization)
            .Where(m => m.UserId == user.Id && m.Status == Data.Entities.V3.MembershipStatus.Active)
            .ToListAsync();

        var orgIds = memberships.Select(m => m.OrganizationId).ToList();
        var membershipIds = memberships.Select(m => m.Id).ToList();

        var leaguePlayers = await dbContext.LeaguePlayers
            .Include(lp => lp.League)
            .Where(lp => orgIds.Contains(lp.OrganizationId)
                         && membershipIds.Contains(lp.OrganizationMembershipId))
            .ToListAsync();

        var leaguePlayersByOrg = leaguePlayers
            .GroupBy(lp => lp.OrganizationId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return memberships.Select(m => new MeOrganizationResponse
        {
            Id = m.Organization.Id,
            Name = m.Organization.Name,
            Slug = m.Organization.Slug,
            Role = m.Role,
            Leagues = leaguePlayersByOrg.TryGetValue(m.OrganizationId, out var lps)
                ? lps.Select(lp => new MeLeagueResponse
                {
                    Id = lp.League.Id,
                    Name = lp.League.Name,
                    Slug = lp.League.Slug,
                    LeaguePlayerId = lp.Id
                }).ToList()
                : []
        }).ToList();
    }

    public async Task<List<MeLeagueResponse>> GetMyLeaguesAsync(Guid organizationId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (user == null)
            return [];

        var membership = await dbContext.OrganizationMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == organizationId
                                      && m.UserId == user.Id
                                      && m.Status == Data.Entities.V3.MembershipStatus.Active);

        if (membership == null)
            return [];

        var leaguePlayers = await dbContext.LeaguePlayers
            .Include(lp => lp.League)
            .Where(lp => lp.OrganizationId == organizationId
                         && lp.OrganizationMembershipId == membership.Id)
            .ToListAsync();

        return leaguePlayers.Select(lp => new MeLeagueResponse
        {
            Id = lp.League.Id,
            Name = lp.League.Name,
            Slug = lp.League.Slug,
            LeaguePlayerId = lp.Id
        }).ToList();
    }
}
