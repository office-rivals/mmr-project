using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Extensions;

public static class OrganizationMembershipExtensions
{
    public static string? GetDisplayName(this OrganizationMembership membership)
        => membership.DisplayName ?? membership.User?.DisplayName;

    public static string? GetUsername(this OrganizationMembership membership)
        => membership.Username ?? membership.User?.Username;
}
