using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.Adapters;

public interface ILegacyContextResolver
{
    Task<Guid> ResolveOrganizationIdAsync();
    Task<Guid> ResolveLeagueIdAsync();
    Task<(Guid orgId, Guid leagueId)> ResolveContextAsync();
}

public class LegacyContextResolver(
    IHttpContextAccessor httpContextAccessor,
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver) : ILegacyContextResolver
{
    private Guid? _cachedOrgId;
    private Guid? _cachedLeagueId;

    public async Task<Guid> ResolveOrganizationIdAsync()
    {
        if (_cachedOrgId.HasValue)
            return _cachedOrgId.Value;

        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext?.Request.Headers.TryGetValue("X-Organization-Id", out var orgHeader) == true
            && Guid.TryParse(orgHeader.FirstOrDefault(), out var orgId))
        {
            _cachedOrgId = orgId;
            return orgId;
        }

        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (user == null)
            throw new InvalidArgumentException("User not found. Cannot resolve organization context.");

        var memberships = await dbContext.OrganizationMemberships
            .Where(m => m.UserId == user.Id && m.Status == MembershipStatus.Active)
            .ToListAsync();

        if (memberships.Count == 0)
            throw new InvalidArgumentException("User is not a member of any organization");

        if (memberships.Count > 1)
            throw new InvalidArgumentException("User belongs to multiple organizations. Specify X-Organization-Id header.");

        _cachedOrgId = memberships[0].OrganizationId;
        return _cachedOrgId.Value;
    }

    public async Task<Guid> ResolveLeagueIdAsync()
    {
        if (_cachedLeagueId.HasValue)
            return _cachedLeagueId.Value;

        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext?.Request.Headers.TryGetValue("X-League-Id", out var leagueHeader) == true
            && Guid.TryParse(leagueHeader.FirstOrDefault(), out var leagueId))
        {
            _cachedLeagueId = leagueId;
            return leagueId;
        }

        var orgId = await ResolveOrganizationIdAsync();

        var leagues = await dbContext.Leagues
            .Where(l => l.OrganizationId == orgId)
            .ToListAsync();

        if (leagues.Count == 0)
            throw new InvalidArgumentException("Organization has no leagues");

        if (leagues.Count > 1)
            throw new InvalidArgumentException("Organization has multiple leagues. Specify X-League-Id header.");

        _cachedLeagueId = leagues[0].Id;
        return _cachedLeagueId.Value;
    }

    public async Task<(Guid orgId, Guid leagueId)> ResolveContextAsync()
    {
        var orgId = await ResolveOrganizationIdAsync();
        var leagueId = await ResolveLeagueIdAsync();
        return (orgId, leagueId);
    }
}
