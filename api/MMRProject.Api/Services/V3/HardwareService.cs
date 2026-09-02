using System.Net;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;

namespace MMRProject.Api.Services.V3;

public interface IHardwareService
{
    Task RecordHeartbeatAsync(HardwareHeartbeatRequest request);
    Task<List<HardwareResponse>> ListAsync(Guid orgId, Guid leagueId);
}

public class HardwareService(ApiDbContext dbContext) : IHardwareService
{
    private static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(15);

    public async Task RecordHeartbeatAsync(HardwareHeartbeatRequest request)
    {
        var hardwareId = NormalizeHardwareId(request.HardwareId);
        var localIpAddress = NormalizeLocalIpAddress(request.LocalIpAddress);

        if (request.LeagueId == Guid.Empty)
            throw new InvalidArgumentException("LeagueId is required");

        var league = await dbContext.Leagues
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == request.LeagueId);

        if (league == null)
            throw new NotFoundException("League not found");

        var hardware = await dbContext.Hardware
            .FirstOrDefaultAsync(h => h.HardwareId == hardwareId);

        var now = DateTimeOffset.UtcNow;
        if (hardware == null)
        {
            hardware = new Hardware
            {
                OrganizationId = league.OrganizationId,
                LeagueId = league.Id,
                HardwareId = hardwareId,
                LocalIpAddress = localIpAddress,
                LastSeenAt = now,
            };
            dbContext.Hardware.Add(hardware);
        }
        else
        {
            hardware.OrganizationId = league.OrganizationId;
            hardware.LeagueId = league.Id;
            hardware.LocalIpAddress = localIpAddress;
            hardware.LastSeenAt = now;
        }

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
        };
    }
}
