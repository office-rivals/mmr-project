using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.IntegrationTests.UserContext;

public class UserContextResolverTests
{
    [Fact]
    public void GetIdentityUserId_UsesLatestHttpContextUser()
    {
        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity())
        };
        var accessor = new HttpContextAccessor
        {
            HttpContext = httpContext
        };

        var resolver = new UserContextResolver(accessor);

        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, "user-123"),
            new Claim(ClaimTypes.Email, "user@test.com")
        ]));

        Assert.Equal("user-123", resolver.GetIdentityUserId());
        Assert.Equal("user@test.com", resolver.GetEmail());
    }
}
