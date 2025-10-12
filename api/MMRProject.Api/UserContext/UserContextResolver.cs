using System.Security.Claims;
using MMRProject.Api.Extensions;

namespace MMRProject.Api.UserContext;

public interface IUserContextResolver
{
    ClaimsPrincipal GetUserIdentity();
    string GetIdentityUserId();
    string? GetEmail();
    bool IsPatAuthentication();
}

public class UserContextResolver : IUserContextResolver
{
    private readonly ClaimsPrincipal _user;
    private readonly Lazy<string> _userId;
    private readonly Lazy<string?> _email;

    public UserContextResolver(IHttpContextAccessor httpContextAccessor)
    {
        _user =
            httpContextAccessor.HttpContext?.User
            ?? throw new Exception("Could not get user from http context");
        _userId = new Lazy<string>(
            () => _user.GetUserId() ?? throw new Exception("Missing user id")
        );
        _email = new Lazy<string?>(
            () => _user.FindFirstValue(ClaimTypes.Email)
                ?? _user.FindFirstValue("email")
        );
    }

    public ClaimsPrincipal GetUserIdentity() => _user;

    public string GetIdentityUserId() => _userId.Value;

    public string? GetEmail() => _email.Value;

    public bool IsPatAuthentication()
    {
        return _user.FindFirstValue("auth_method") == "pat";
    }
}