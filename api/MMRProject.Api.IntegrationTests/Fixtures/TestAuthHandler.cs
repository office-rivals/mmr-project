using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MMRProject.Api.IntegrationTests.Fixtures;

public class TestClaimsProvider
{
    public List<Claim> Claims { get; } = [];

    public void SetUser(string identityUserId, string? email = null)
    {
        Claims.Clear();
        Claims.Add(new Claim(ClaimTypes.NameIdentifier, identityUserId));
        if (email != null)
        {
            Claims.Add(new Claim(ClaimTypes.Email, email));
        }
    }

    public void AddClaim(string type, string value)
    {
        Claims.Add(new Claim(type, value));
    }
}

public class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    TestClaimsProvider claimsProvider)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (claimsProvider.Claims.Count == 0)
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var identity = new ClaimsIdentity(claimsProvider.Claims, "TestScheme");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "TestScheme");

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
