using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Auth;

public class HardwareSecretAuthenticationOptions : AuthenticationSchemeOptions;

public class HardwareSecretAuthenticationHandler(
    IOptionsMonitor<HardwareSecretAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IHardwareService hardwareService
)
    : AuthenticationHandler<HardwareSecretAuthenticationOptions>(options, logger, encoder)
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

        var secret = authHeaderValue["Bearer ".Length..].Trim();
        if (!secret.StartsWith("hw_"))
        {
            return AuthenticateResult.NoResult();
        }

        var hardware = await hardwareService.ValidateSecretAsync(secret);
        if (hardware is null)
        {
            return AuthenticateResult.Fail("Invalid or revoked hardware secret");
        }

        var claims = new[]
        {
            new Claim("auth_method", "hardware"),
            new Claim("hardware_id", hardware.Id.ToString()),
            new Claim("hardware_org_id", hardware.OrganizationId.ToString()),
            new Claim("hardware_league_id", hardware.LeagueId.ToString()),
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }
}
