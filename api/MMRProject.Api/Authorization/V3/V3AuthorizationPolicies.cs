namespace MMRProject.Api.Authorization.V3;

public static class V3AuthorizationPolicies
{
    public const string RequireOrgOwner = "RequireOrgOwner";
    public const string RequireOrgModerator = "RequireOrgModerator";
    public const string RequireOrgMember = "RequireOrgMember";
    public const string RequireLeagueAccess = "RequireLeagueAccess";
    public const string RequirePatWrite = "RequirePatWrite";
    public const string DenyPatAuthentication = "DenyPatAuthentication";
}
