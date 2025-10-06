using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using MMRProject.Api.Services;

namespace MMRProject.Api.Auth;

public class PersonalAccessTokenAuthenticationOptions : AuthenticationSchemeOptions;

public class PersonalAccessTokenAuthenticationHandler(
    IOptionsMonitor<PersonalAccessTokenAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IPersonalAccessTokenService personalAccessTokenService
)
    : AuthenticationHandler<PersonalAccessTokenAuthenticationOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var authHeader) ||
            string.IsNullOrEmpty(authHeader))
        {
            return AuthenticateResult.NoResult();
        }

        var authHeaderValue = authHeader.ToString();
        if (!authHeaderValue.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return AuthenticateResult.NoResult();
        }

        var token = authHeaderValue["Bearer ".Length..].Trim();
        if (!token.StartsWith("pat_"))
        {
            return AuthenticateResult.NoResult();
        }

        var personalAccessToken = await personalAccessTokenService.UseTokenAsync(token);

        if (personalAccessToken is null)
        {
            return AuthenticateResult.Fail("Invalid or expired personal access token");
        }

        var identityUserId = personalAccessToken.Player?.IdentityUserId;
        if (identityUserId is null)
        {
            // TODO: We should handle this in a better way
            return AuthenticateResult.Fail("Token player is not linked to an identity user");
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, identityUserId),
            new Claim("sub", identityUserId),
            new Claim("auth_method", "pat"),
            new Claim("pat_id", personalAccessToken.Id.ToString())
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }
}