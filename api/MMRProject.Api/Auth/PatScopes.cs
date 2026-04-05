namespace MMRProject.Api.Auth;

public static class PatScopes
{
    public const string Write = "write";

    public static bool TryNormalize(string? scope, out string normalizedScope)
    {
        normalizedScope = (scope ?? string.Empty).Trim().ToLowerInvariant();
        return normalizedScope == Write;
    }

    public static bool HasRequiredScope(string grantedScope, string requiredScope)
    {
        return grantedScope == Write && requiredScope == Write;
    }
}
