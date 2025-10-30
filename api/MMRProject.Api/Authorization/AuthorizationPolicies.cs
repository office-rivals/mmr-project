namespace MMRProject.Api.Authorization;

public static class AuthorizationPolicies
{
    public const string RequireOwnerRole = "RequireOwnerRole";
    public const string RequireModeratorRole = "RequireModeratorRole";
    public const string RequireUserRole = "RequireUserRole";
}
