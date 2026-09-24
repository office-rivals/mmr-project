using Microsoft.AspNetCore.Authorization;
using MMRProject.Api.Extensions;

namespace MMRProject.Api.Authorization.V3;

public sealed class HardwareAuthenticationRequirement : IAuthorizationRequirement;

public class HardwareAuthorizationHandler : AuthorizationHandler<HardwareAuthenticationRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        HardwareAuthenticationRequirement requirement)
    {
        if (context.User.IsHardwareAuthentication())
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
