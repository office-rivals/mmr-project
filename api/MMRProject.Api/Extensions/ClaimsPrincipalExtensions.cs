using System.Security.Claims;

namespace MMRProject.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserId(this ClaimsPrincipal user)
    {
        // TODO: Test this with a common JWT
        return user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    }

    public static bool IsPatAuthentication(this ClaimsPrincipal user)
    {
        return user.FindFirstValue("auth_method") == "pat";
    }

    public static string? GetPatScope(this ClaimsPrincipal user)
    {
        return user.FindFirstValue("pat_scope");
    }

    public static Guid? GetPatOrganizationId(this ClaimsPrincipal user)
    {
        return GetGuidClaim(user, "pat_org_id");
    }

    public static Guid? GetPatLeagueId(this ClaimsPrincipal user)
    {
        return GetGuidClaim(user, "pat_league_id");
    }

    private static Guid? GetGuidClaim(ClaimsPrincipal user, string claimType)
    {
        var value = user.FindFirstValue(claimType);
        return Guid.TryParse(value, out var parsed) ? parsed : null;
    }
}
