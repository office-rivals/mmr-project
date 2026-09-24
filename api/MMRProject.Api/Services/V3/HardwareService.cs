using System.Net;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;

namespace MMRProject.Api.Services.V3;

public interface IHardwareService
{
    Task RecordHeartbeatAsync(Guid hardwareId, HardwareHeartbeatRequest request);
    Task<List<HardwareResponse>> ListAsync(Guid orgId, Guid leagueId);
    Task<RegisterHardwareResponse> RegisterAsync(Guid orgId, Guid leagueId, RegisterHardwareRequest request);
    Task<RotateHardwareSecretResponse> RotateSecretAsync(Guid orgId, Guid leagueId, Guid hardwareId);
    Task RevokeAsync(Guid orgId, Guid leagueId, Guid hardwareId);
    Task<Hardware?> ValidateSecretAsync(string secret);
}

public class HardwareService(ApiDbContext dbContext) : IHardwareService
{
    private const string SecretPrefix = "hw_";
    private static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(15);

    public async Task RecordHeartbeatAsync(Guid hardwareId, HardwareHeartbeatRequest request)
    {
        var localIpAddress = NormalizeLocalIpAddress(request.LocalIpAddress);

        var hardware = await dbContext.Hardware.FirstOrDefaultAsync(h => h.Id == hardwareId)
            ?? throw new NotFoundException("Hardware not found");

        hardware.LocalIpAddress = localIpAddress;
        hardware.LastSeenAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync();
    }

    public async Task<List<HardwareResponse>> ListAsync(Guid orgId, Guid leagueId)
    {
        var leagueExists = await dbContext.Leagues
            .AnyAsync(l => l.Id == leagueId && l.OrganizationId == orgId);

        if (!leagueExists)
            throw new NotFoundException("League not found");

        var now = DateTimeOffset.UtcNow;
        var hardware = await dbContext.Hardware
            .AsNoTracking()
            .Where(h => h.OrganizationId == orgId && h.LeagueId == leagueId)
            .OrderBy(h => h.HardwareId)
            .ToListAsync();

        return hardware.Select(h => MapToResponse(h, now)).ToList();
    }

    public async Task<RegisterHardwareResponse> RegisterAsync(Guid orgId, Guid leagueId, RegisterHardwareRequest request)
    {
        var hardwareId = NormalizeHardwareId(request.HardwareId);

        var leagueBelongsToOrg = await dbContext.Leagues
            .AnyAsync(l => l.Id == leagueId && l.OrganizationId == orgId);
        if (!leagueBelongsToOrg)
            throw new NotFoundException("League not found");

        var alreadyRegistered = await dbContext.Hardware.AnyAsync(h => h.HardwareId == hardwareId);
        if (alreadyRegistered)
            throw new InvalidArgumentException("HardwareId is already registered");

        var secret = GenerateRandomSecret();
        var hardware = new Hardware
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            HardwareId = hardwareId,
            LocalIpAddress = "0.0.0.0",
            SecretHash = HashSecret(secret),
        };
        dbContext.Hardware.Add(hardware);
        await dbContext.SaveChangesAsync();

        return new RegisterHardwareResponse
        {
            Id = hardware.Id,
            HardwareId = hardware.HardwareId,
            OrganizationId = hardware.OrganizationId,
            LeagueId = hardware.LeagueId,
            Secret = secret,
        };
    }

    public async Task<RotateHardwareSecretResponse> RotateSecretAsync(Guid orgId, Guid leagueId, Guid hardwareId)
    {
        var hardware = await FindHardwareAsync(orgId, leagueId, hardwareId);

        var secret = GenerateRandomSecret();
        hardware.SecretHash = HashSecret(secret);
        await dbContext.SaveChangesAsync();

        return new RotateHardwareSecretResponse { Secret = secret };
    }

    public async Task RevokeAsync(Guid orgId, Guid leagueId, Guid hardwareId)
    {
        var hardware = await FindHardwareAsync(orgId, leagueId, hardwareId);

        hardware.RevokedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync();
    }

    public async Task<Hardware?> ValidateSecretAsync(string secret)
    {
        var secretHash = HashSecret(secret);
        var hardware = await dbContext.Hardware
            .FirstOrDefaultAsync(h => h.SecretHash != null && h.SecretHash.SequenceEqual(secretHash));

        return hardware is null || hardware.RevokedAt.HasValue ? null : hardware;
    }

    private async Task<Hardware> FindHardwareAsync(Guid orgId, Guid leagueId, Guid hardwareId)
    {
        return await dbContext.Hardware
            .FirstOrDefaultAsync(h => h.Id == hardwareId && h.OrganizationId == orgId && h.LeagueId == leagueId)
            ?? throw new NotFoundException("Hardware not found");
    }

    private static string GenerateRandomSecret()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return SecretPrefix + Convert.ToHexStringLower(bytes);
    }

    private static byte[] HashSecret(string secret) => SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(secret));

    private static string NormalizeHardwareId(string value)
    {
        var normalized = value.Trim().ToUpperInvariant();
        if (normalized.Length == 0)
            throw new InvalidArgumentException("HardwareId is required");

        return normalized;
    }

    private static string NormalizeLocalIpAddress(string value)
    {
        var normalized = value.Trim();
        if (!IPAddress.TryParse(normalized, out _))
            throw new InvalidArgumentException("LocalIpAddress must be a valid IP address");

        return normalized;
    }

    private static HardwareResponse MapToResponse(Hardware hardware, DateTimeOffset now)
    {
        return new HardwareResponse
        {
            Id = hardware.Id,
            HardwareId = hardware.HardwareId,
            OrganizationId = hardware.OrganizationId,
            LeagueId = hardware.LeagueId,
            LocalIpAddress = hardware.LocalIpAddress,
            LastSeenAt = hardware.LastSeenAt,
            IsOnline = hardware.LastSeenAt >= now - OnlineWindow,
            RevokedAt = hardware.RevokedAt,
        };
    }
}
