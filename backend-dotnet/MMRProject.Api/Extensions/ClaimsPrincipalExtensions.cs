using System.Security.Claims;

namespace MMRProject.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserId(this ClaimsPrincipal user)
    {
        // TODO: Test this with a common JWT
        return user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    }
}