using Microsoft.AspNetCore.Authorization;

namespace MMRProject.Api.Authorization.V3;

public sealed class PatScopeRequirement(string requiredScope) : IAuthorizationRequirement
{
    public string RequiredScope { get; } = requiredScope;
}

public sealed class DenyPatAuthenticationRequirement : IAuthorizationRequirement;
