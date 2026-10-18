using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MMRProject.Api.Data;
using MMRProject.Api.Services.V3;
using MMRProject.Api.Data.Entities.V3;
using Npgsql;

namespace MMRProject.Api.Auth;

public class DeviceAuthenticationOptions : AuthenticationSchemeOptions;

/// <summary>
/// Table devices (goal counters, scoreboards). Every request carries
/// <c>X-Device-Id: fb-&lt;mac&gt;</c>, <c>Authorization: Device &lt;64 hex secret&gt;</c> and
/// <c>X-Enrolment-Token</c>. A known device is verified against its stored secret hash only, so a
/// rotated or revoked enrolment token never locks out a registered device. An unknown (or reset)
/// device with a valid organization enrolment token is registered as unclaimed in that organization.
/// </summary>
public partial class DeviceAuthenticationHandler(
    IOptionsMonitor<DeviceAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ApiDbContext dbContext
)
    : AuthenticationHandler<DeviceAuthenticationOptions>(options, logger, encoder)
{
    public const string SchemeName = "Device";
    public const string DevicePkClaim = "device_pk";

    [GeneratedRegex("^fb-[0-9a-f]{12}$")]
    public static partial Regex HardwareIdPattern();

    [GeneratedRegex("^[0-9a-f]{64}$")]
    private static partial Regex SecretPattern();

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        if (!authHeader.StartsWith(SchemeName + " ", StringComparison.Ordinal))
        {
            return AuthenticateResult.NoResult();
        }

        var secret = authHeader[(SchemeName.Length + 1)..].Trim();
        var hardwareId = Request.Headers["X-Device-Id"].ToString();
        if (!HardwareIdPattern().IsMatch(hardwareId) || !SecretPattern().IsMatch(secret))
        {
            return AuthenticateResult.Fail("Malformed device credentials");
        }

        var secretHash = Hash(secret);
        var device = await dbContext.Devices.FirstOrDefaultAsync(d => d.HardwareId == hardwareId);

        if (device?.SecretHash is null)
        {
            device = await EnrolAsync(device, hardwareId, secretHash);
            if (device is null)
            {
                return AuthenticateResult.Fail("Unknown device and no valid enrolment token");
            }
        }

        if (!CryptographicOperations.FixedTimeEquals(device.SecretHash ?? [], secretHash))
        {
            return AuthenticateResult.Fail("Device secret mismatch");
        }

        // METRICS §8.2 "awake since": a new wake after a status (which clears it) or a silence longer than an
        // awake device keeps (a lost sleep status).
        var now = DateTimeOffset.UtcNow;
        if (device.AwakeSince is null || device.LastSeenAt is not { } lastSeen || lastSeen < now - TableOccupancy.AwakeWindow(device.Role))
        {
            device.AwakeSince = now;
        }

        device.LastSeenAt = now;
        await dbContext.SaveChangesAsync();

        var identity = new ClaimsIdentity(
            [
                new Claim(DevicePkClaim, device.Id.ToString()),
                new Claim("device_id", device.HardwareId),
                new Claim("auth_method", "device"),
            ],
            Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }

    private async Task<Device?> EnrolAsync(Device? device, string hardwareId, byte[] secretHash)
    {
        var token = Request.Headers["X-Enrolment-Token"].ToString();
        if (string.IsNullOrEmpty(token))
        {
            return null;
        }

        var tokenHash = Hash(token);
        var orgId = await dbContext.Organizations
            .Where(o => o.DeviceEnrolmentTokenHash == tokenHash)
            .Select(o => (Guid?)o.Id)
            .FirstOrDefaultAsync();
        if (orgId is null)
        {
            return null;
        }

        if (device is null)
        {
            device = new Device { HardwareId = hardwareId, OrganizationId = orgId.Value };
            dbContext.Devices.Add(device);
        }

        // A device pre-registered (or reset) in this org keeps its assignment; moving orgs clears it.
        if (device.OrganizationId != orgId.Value)
        {
            device.OrganizationId = orgId.Value;
            device.Claimed = false;
            device.ClaimedAt = null;
            device.Role = null;
            device.TableId = null;
            device.End = null;
        }

        device.SecretHash = secretHash;

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Two first requests raced; the other one registered it. Verify against that.
            dbContext.Entry(device).State = EntityState.Detached;
            return await dbContext.Devices.FirstOrDefaultAsync(d => d.HardwareId == hardwareId);
        }

        Logger.LogInformation("Device {HardwareId} enrolled into organization {OrganizationId}", hardwareId, orgId);
        return device;
    }

    public static byte[] Hash(string value) => SHA256.HashData(Encoding.UTF8.GetBytes(value));
}
