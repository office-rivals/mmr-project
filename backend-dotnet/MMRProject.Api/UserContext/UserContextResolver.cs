using System.Security.Claims;
using MMRProject.Api.Extensions;

namespace MMRProject.Api.UserContext;

public interface IUserContextResolver
{
    ClaimsPrincipal GetUserIdentity();
    string GetIdentityUserId();
}

public class UserContextResolver : IUserContextResolver
{
    private readonly ClaimsPrincipal _user;
    private readonly Lazy<string> _userId;

    public UserContextResolver(IHttpContextAccessor httpContextAccessor)
    {
        _user =
            httpContextAccessor.HttpContext?.User
            ?? throw new Exception("Could not get user from http context");
        _userId = new Lazy<string>(
            () => _user.GetUserId() ?? throw new Exception("Missing user id")
        );
    }

    public ClaimsPrincipal GetUserIdentity() => _user;

    public string GetIdentityUserId() => _userId.Value;
}