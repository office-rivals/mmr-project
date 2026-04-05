using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Extensions;

namespace MMRProject.Api.Authorization.V3;

public class OrganizationRoleAuthorizationHandler(
    IHttpContextAccessor httpContextAccessor,
    IServiceScopeFactory serviceScopeFactory)
    : AuthorizationHandler<OrganizationRoleRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OrganizationRoleRequirement requirement)
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext == null)
            return;

        var orgIdValue = httpContext.Request.RouteValues["orgId"]?.ToString();
        if (orgIdValue == null || !Guid.TryParse(orgIdValue, out var orgId))
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
            .Select(m => new { m.Role })
            .FirstOrDefaultAsync();

        if (membership != null && membership.Role <= requirement.MinimumRole)
        {
            context.Succeed(requirement);
        }
    }
}
