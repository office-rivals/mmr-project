using Microsoft.AspNetCore.Authorization;
using MMRProject.Api.Auth;
using MMRProject.Api.Extensions;

namespace MMRProject.Api.Authorization.V3;

public class PatAuthorizationHandler(IHttpContextAccessor httpContextAccessor)
    : AuthorizationHandler<PatScopeRequirement>, IAuthorizationHandler
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PatScopeRequirement requirement)
    {
        if (!context.User.IsPatAuthentication())
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var grantedScope = context.User.GetPatScope();
        if (grantedScope == null || !PatScopes.HasRequiredScope(grantedScope, requirement.RequiredScope))
        {
            return Task.CompletedTask;
        }

        var httpContext = httpContextAccessor.HttpContext;
        var orgId = httpContext?.Request.RouteValues["orgId"]?.ToString();
        if (orgId == null)
        {
            return Task.CompletedTask;
        }

        var patOrgId = context.User.GetPatOrganizationId();
        if (!patOrgId.HasValue || patOrgId.Value.ToString() != orgId)
        {
            return Task.CompletedTask;
        }

        var patLeagueId = context.User.GetPatLeagueId();
        var leagueId = httpContext?.Request.RouteValues["leagueId"]?.ToString();

        if (patLeagueId.HasValue)
        {
            if (leagueId == null || patLeagueId.Value.ToString() != leagueId)
            {
                return Task.CompletedTask;
            }
        }

        context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

public class DenyPatAuthenticationHandler : AuthorizationHandler<DenyPatAuthenticationRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        DenyPatAuthenticationRequirement requirement)
    {
        if (!context.User.IsPatAuthentication())
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
