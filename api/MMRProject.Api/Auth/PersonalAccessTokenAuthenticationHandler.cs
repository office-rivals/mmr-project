using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Auth;

public class PersonalAccessTokenAuthenticationOptions : AuthenticationSchemeOptions;

public class PersonalAccessTokenAuthenticationHandler(
    IOptionsMonitor<PersonalAccessTokenAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IV3PersonalAccessTokenService personalAccessTokenService
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

        var personalAccessToken = await personalAccessTokenService.ValidateTokenAsync(token);

        if (personalAccessToken is null)
        {
            return AuthenticateResult.Fail("Invalid or expired personal access token");
        }

        var identityUserId = personalAccessToken.User?.IdentityUserId;
        if (identityUserId is null)
        {
            return AuthenticateResult.Fail("Token player is not linked to an identity user");
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, identityUserId),
            new Claim("sub", identityUserId),
            new Claim("auth_method", "pat"),
            new Claim("pat_id", personalAccessToken.Id.ToString()),
            new Claim("pat_scope", personalAccessToken.Scope)
        };

        var scopedClaims = claims.ToList();
        if (personalAccessToken.OrganizationId.HasValue)
        {
            scopedClaims.Add(new Claim("pat_org_id", personalAccessToken.OrganizationId.Value.ToString()));
        }

        if (personalAccessToken.LeagueId.HasValue)
        {
            scopedClaims.Add(new Claim("pat_league_id", personalAccessToken.LeagueId.Value.ToString()));
        }

        var identity = new ClaimsIdentity(scopedClaims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }
}
