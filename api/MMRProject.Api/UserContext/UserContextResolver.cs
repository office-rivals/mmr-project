using System.Security.Claims;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.Extensions;

namespace MMRProject.Api.UserContext;

public interface IUserContextResolver
{
    ClaimsPrincipal GetUserIdentity();
    string GetIdentityUserId();
    string? GetEmail();
    bool IsPatAuthentication();
    PlayerRole GetRole();
    bool HasRole(PlayerRole minimumRole);
}

public class UserContextResolver : IUserContextResolver
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public UserContextResolver(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal GetCurrentUser()
        => _httpContextAccessor.HttpContext?.User
           ?? throw new Exception("Could not get user from http context");

    public ClaimsPrincipal GetUserIdentity() => GetCurrentUser();

    public string GetIdentityUserId()
        => GetCurrentUser().GetUserId() ?? throw new Exception("Missing user id");

    public string? GetEmail()
        => GetCurrentUser().FindFirstValue(ClaimTypes.Email)
           ?? GetCurrentUser().FindFirstValue("email");

    public bool IsPatAuthentication()
    {
        return GetCurrentUser().FindFirstValue("auth_method") == "pat";
    }

    public PlayerRole GetRole()
    {
        var roleClaim = GetCurrentUser().FindFirstValue("player_role");
        return Enum.TryParse<PlayerRole>(roleClaim, out var role)
            ? role
            : PlayerRole.User;
    }

    public bool HasRole(PlayerRole minimumRole)
    {
        return GetRole() >= minimumRole;
    }
}
