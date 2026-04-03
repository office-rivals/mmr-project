using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Extensions;

namespace MMRProject.Api.Authorization.V3;

public class LeagueAccessAuthorizationHandler(
    IHttpContextAccessor httpContextAccessor,
    IServiceScopeFactory serviceScopeFactory)
    : AuthorizationHandler<LeagueAccessRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        LeagueAccessRequirement requirement)
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext == null)
            return;

        var orgIdValue = httpContext.Request.RouteValues["orgId"]?.ToString();
        var leagueIdValue = httpContext.Request.RouteValues["leagueId"]?.ToString();
        if (!Guid.TryParse(orgIdValue, out var orgId) || !Guid.TryParse(leagueIdValue, out var leagueId))
            return;

        var identityUserId = context.User.GetUserId();
        if (identityUserId == null)
            return;

        using var scope = serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var membership = await dbContext.OrganizationMemberships
            .Where(m => m.OrganizationId == orgId
                        && m.User!.IdentityUserId == identityUserId
                        && m.Status == MembershipStatus.Active)
            .Select(m => new { m.Id, m.Role })
            .FirstOrDefaultAsync();

        if (membership == null)
            return;

        if (membership.Role <= OrganizationRole.Moderator)
        {
            context.Succeed(requirement);
            return;
        }

        var leagueExists = await dbContext.Leagues
            .AnyAsync(l => l.OrganizationId == orgId && l.Id == leagueId);

        if (!leagueExists)
        {
            context.Succeed(requirement);
            return;
        }

        var hasLeagueAccess = await dbContext.LeaguePlayers
            .AnyAsync(lp => lp.OrganizationId == orgId
                            && lp.LeagueId == leagueId
                            && lp.OrganizationMembershipId == membership.Id);

        if (hasLeagueAccess)
        {
            context.Succeed(requirement);
        }
    }
}
