using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MMRProject.Api.Data;

namespace MMRProject.Api.Auth;

public class PersonalAccessTokenAuthenticationOptions : AuthenticationSchemeOptions
{
}

public class PersonalAccessTokenAuthenticationHandler(
    IOptionsMonitor<PersonalAccessTokenAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ApiDbContext dbContext)
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

        var tokenHash = HashToken(token);
        var personalAccessToken = await dbContext.PersonalAccessTokens
            .Include(p => p.Player)
            .FirstOrDefaultAsync(p => p.TokenHash == tokenHash);

        if (personalAccessToken == null)
        {
            return AuthenticateResult.Fail("Invalid token");
        }

        if (personalAccessToken.ExpiresAt.HasValue && personalAccessToken.ExpiresAt.Value < DateTime.UtcNow)
        {
            return AuthenticateResult.Fail("Token expired");
        }

        personalAccessToken.LastUsedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, personalAccessToken.PlayerId.ToString()),
            new Claim("sub", personalAccessToken.PlayerId.ToString()),
            new Claim("auth_method", "pat"),
            new Claim("pat_id", personalAccessToken.Id.ToString())
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }

    private static byte[] HashToken(string token)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(token));
    }
}