using Microsoft.AspNetCore.Authorization;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Authorization.V3;

public class OrganizationRoleRequirement(OrganizationRole minimumRole) : IAuthorizationRequirement
{
    public OrganizationRole MinimumRole { get; } = minimumRole;
}
