using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface ISessionService
{
    Task<MeResponse> GetMeAsync();
    Task<BadgesResponse> GetBadgesAsync();
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

        return new MeResponse
        {
            Id = user.Id,
            IdentityUserId = user.IdentityUserId,
            Email = user.Email,
            Username = user.Username,
            DisplayName = user.DisplayName,
            Organizations = await BuildOrganizationResponsesAsync(user.Id)
        };
    }

    // Open match-flag counts for the orgs this user can administer (Owner or
    // Moderator), keyed by org/league id so the client can badge the nav.
    // Served from its own lightweight endpoint rather than bloating /me.
    public async Task<BadgesResponse> GetBadgesAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (user == null)
            return EmptyBadges();

        var moderatorOrgIds = await dbContext.OrganizationMemberships
            .Where(m => m.UserId == user.Id
                        && m.Status == MembershipStatus.Active
                        && (m.Role == OrganizationRole.Owner || m.Role == OrganizationRole.Moderator))
            .Select(m => m.OrganizationId)
            .ToListAsync();

        if (moderatorOrgIds.Count == 0)
            return EmptyBadges();

        var counts = await dbContext.Set<V3MatchFlag>()
            .Where(f => f.Status == MatchFlagStatus.Open
                        && moderatorOrgIds.Contains(f.OrganizationId))
            .GroupBy(f => new { f.OrganizationId, f.LeagueId })
            .Select(g => new { g.Key.OrganizationId, g.Key.LeagueId, Count = g.Count() })
            .ToListAsync();

        return new BadgesResponse
        {
            OpenMatchFlags = new OpenMatchFlagSummary
            {
                Total = counts.Sum(c => c.Count),
                // Both group before keying: the rows are keyed by (org, league),
                // so a league id can appear more than once if a flag's org and
                // league ever disagree. Summing is cheaper than a 500.
                ByOrganization = counts
                    .GroupBy(c => c.OrganizationId)
                    .ToDictionary(g => g.Key, g => g.Sum(c => c.Count)),
                ByLeague = counts
                    .GroupBy(c => c.LeagueId)
                    .ToDictionary(g => g.Key, g => g.Sum(c => c.Count))
            }
        };
    }

    private static BadgesResponse EmptyBadges() => new()
    {
        OpenMatchFlags = new OpenMatchFlagSummary
        {
            Total = 0,
            ByOrganization = new Dictionary<Guid, int>(),
            ByLeague = new Dictionary<Guid, int>()
        }
    };

    public async Task<List<MeOrganizationResponse>> GetMyOrganizationsAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (user == null)
            return [];

        return await BuildOrganizationResponsesAsync(user.Id);
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
            .OrderBy(lp => lp.CreatedAt).ThenBy(lp => lp.League.Slug)
            .ToListAsync();

        return leaguePlayers.Select(MapToLeagueResponse).ToList();
    }

    private async Task<List<MeOrganizationResponse>> BuildOrganizationResponsesAsync(Guid userId)
    {
        // Stable join-order so consumers (e.g. the frontend's default org/league
        // pick, which takes the first entry) don't depend on DB row order.
        var memberships = await dbContext.OrganizationMemberships
            .Include(m => m.Organization)
            .Where(m => m.UserId == userId && m.Status == Data.Entities.V3.MembershipStatus.Active)
            .OrderBy(m => m.CreatedAt).ThenBy(m => m.Organization.Slug)
            .ToListAsync();

        var orgIds = memberships.Select(m => m.OrganizationId).ToList();
        var membershipIds = memberships.Select(m => m.Id).ToList();

        var leaguePlayers = await dbContext.LeaguePlayers
            .Include(lp => lp.League)
            .Where(lp => orgIds.Contains(lp.OrganizationId)
                         && membershipIds.Contains(lp.OrganizationMembershipId))
            .OrderBy(lp => lp.CreatedAt).ThenBy(lp => lp.League.Slug)
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
                ? lps.Select(MapToLeagueResponse).ToList()
                : []
        }).ToList();
    }

    private static MeLeagueResponse MapToLeagueResponse(Data.Entities.V3.LeaguePlayer lp)
    {
        return new MeLeagueResponse
        {
            Id = lp.League.Id,
            Name = lp.League.Name,
            Slug = lp.League.Slug,
            TeamSize = lp.League.TeamSize,
            WinningScore = lp.League.WinningScore,
            LeaguePlayerId = lp.Id
        };
    }
}
