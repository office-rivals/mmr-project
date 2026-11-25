using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Auth;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using Npgsql;

namespace MMRProject.Api.Services.V3;

public interface IHardwareAdminService
{
    Task<List<TableResponse>> ListTablesAsync(Guid orgId);
    Task<TableResponse> CreateTableAsync(Guid orgId, UpsertTableRequest request);
    Task<TableResponse> UpdateTableAsync(Guid orgId, Guid tableId, UpsertTableRequest request);
    Task DeleteTableAsync(Guid orgId, Guid tableId);
    /// <summary>A new random code, or <paramref name="code"/> (readable; unique across all short links).</summary>
    Task<TableResponse> SetTableShortCodeAsync(Guid orgId, Guid tableId, string? code);

    Task<List<DeviceResponse>> ListDevicesAsync(Guid orgId);
    Task<List<OrphanGoalResponse>> ListOrphanGoalsAsync(Guid orgId, Guid? tableId);
    Task<DeviceResponse> AssignDeviceAsync(Guid orgId, string deviceId, AssignDeviceRequest request);
    Task<DeviceResponse> ResetDeviceAsync(Guid orgId, string deviceId);
    /// <summary>Replaces a goal counter's beam config; null fields go back to the firmware default.</summary>
    Task<DeviceResponse> SetBeamConfigAsync(Guid orgId, string deviceId, BeamConfig config);

    Task<EnrolmentTokenStatusResponse> GetEnrolmentTokenStatusAsync(Guid orgId);
    Task<EnrolmentTokenResponse> RotateEnrolmentTokenAsync(Guid orgId);
    Task RevokeEnrolmentTokenAsync(Guid orgId);
}

public class HardwareAdminService(ApiDbContext dbContext, IConfiguration configuration) : IHardwareAdminService
{
    public async Task<List<TableResponse>> ListTablesAsync(Guid orgId)
    {
        var tables = await dbContext.FoosballTables.AsNoTracking()
            .Where(t => t.OrganizationId == orgId)
            .OrderBy(t => t.Name)
            .ToListAsync();

        var result = new List<TableResponse>();
        foreach (var table in tables)
        {
            result.Add(await HardwareMapping.MapTableAsync(dbContext, configuration, table));
        }

        return result;
    }

    public async Task<TableResponse> CreateTableAsync(Guid orgId, UpsertTableRequest request)
    {
        var table = new FoosballTable { OrganizationId = orgId, Name = request.Name };
        await ApplyAsync(orgId, table, request);
        dbContext.FoosballTables.Add(table);
        await dbContext.SaveChangesAsync();
        return await HardwareMapping.MapTableAsync(dbContext, configuration, table);
    }

    public async Task<TableResponse> UpdateTableAsync(Guid orgId, Guid tableId, UpsertTableRequest request)
    {
        var table = await FindTableAsync(orgId, tableId);
        await ApplyAsync(orgId, table, request);
        // Labels and the league (table_url) show on the scoreboard.
        table.StateVersion++;
        await dbContext.SaveChangesAsync();
        return await HardwareMapping.MapTableAsync(dbContext, configuration, table);
    }

    public async Task<TableResponse> SetTableShortCodeAsync(Guid orgId, Guid tableId, string? code)
    {
        var table = await FindTableAsync(orgId, tableId);
        if (code is null)
        {
            table.ShortCode = ShortCode.New();
        }
        else
        {
            var custom = code.Trim().ToLowerInvariant();
            if (!ShortCode.CustomPattern().IsMatch(custom))
            {
                throw new InvalidArgumentException("A code is 3 to 32 letters, digits or hyphens");
            }

            // Links resolve case-insensitively, random codes also Crockford-normalised: no code may read as another.
            var (upper, crockford) = (custom.ToUpperInvariant(), ShortCode.Normalize(custom));
            var taken = await dbContext.FoosballTables.AnyAsync(t => t.Id != tableId &&
                            (t.ShortCode.ToUpper() == upper || t.ShortCode.ToUpper() == crockford)) ||
                        await dbContext.TableMatches.AnyAsync(m => m.ShortCode == upper || m.ShortCode == crockford) ||
                        await dbContext.CardLinkRequests.AnyAsync(r => r.ShortCode == upper || r.ShortCode == crockford);
            if (taken)
            {
                throw new ConflictException("This code is already taken");
            }

            table.ShortCode = custom;
        }

        table.StateVersion++;
        await dbContext.SaveChangesAsync();
        return await HardwareMapping.MapTableAsync(dbContext, configuration, table);
    }

    public async Task DeleteTableAsync(Guid orgId, Guid tableId)
    {
        var table = await FindTableAsync(orgId, tableId);
        await dbContext.Devices.Where(d => d.TableId == tableId)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.ConfigVersion, d => d.ConfigVersion + 1));
        dbContext.FoosballTables.Remove(table);
        await dbContext.SaveChangesAsync();
    }

    public async Task<List<DeviceResponse>> ListDevicesAsync(Guid orgId)
    {
        var devices = await dbContext.Devices.AsNoTracking()
            .Where(d => d.OrganizationId == orgId)
            .OrderBy(d => d.Claimed).ThenBy(d => d.HardwareId)
            .ToListAsync();
        return devices.Select(MapDevice).ToList();
    }

    public Task<List<OrphanGoalResponse>> ListOrphanGoalsAsync(Guid orgId, Guid? tableId) =>
        dbContext.TableGoals.AsNoTracking()
            .Where(g => g.OrganizationId == orgId && g.OrphanReason != null)
            .Where(g => tableId == null || g.TableId == tableId)
            .OrderByDescending(g => g.ReceivedAt)
            .Take(200)
            .Join(dbContext.Devices, g => g.DeviceId, d => d.Id, (g, d) => new OrphanGoalResponse
            {
                Id = g.Id,
                EventId = g.EventId,
                DeviceId = d.HardwareId,
                TableId = g.TableId,
                End = g.ScoringEnd,
                OccurredAt = g.OccurredAt,
                ReceivedAt = g.ReceivedAt,
                Reason = g.OrphanReason!.Value,
            })
            .ToListAsync();

    public async Task<DeviceResponse> AssignDeviceAsync(Guid orgId, string deviceId, AssignDeviceRequest request)
    {
        var device = await FindDeviceAsync(orgId, deviceId);

        if (request.TableId is { } tableId)
        {
            if (request.End is null)
                throw new InvalidArgumentException("An end is required when assigning a device to a table");
            await FindTableAsync(orgId, tableId);
        }

        device.Role = request.Role;
        device.TableId = request.TableId;
        device.End = request.TableId is null ? null : request.End;
        device.Claimed = true;
        device.ClaimedAt ??= DateTimeOffset.UtcNow;
        device.ConfigVersion++;

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           {
                                               SqlState: PostgresErrorCodes.UniqueViolation,
                                               ConstraintName: "ix_devices_table_goal_end"
                                           })
        {
            throw new ConflictException("Another goal counter already watches that goal");
        }

        return MapDevice(device);
    }

    public async Task<DeviceResponse> ResetDeviceAsync(Guid orgId, string deviceId)
    {
        var device = await FindDeviceAsync(orgId, deviceId);
        // The device re-enrols (unclaimed) with its next request, using a valid enrolment token.
        device.SecretHash = null;
        device.Claimed = false;
        device.ClaimedAt = null;
        device.Role = null;
        device.TableId = null;
        device.End = null;
        device.ConfigVersion++;
        await dbContext.SaveChangesAsync();
        return MapDevice(device);
    }

    public async Task<DeviceResponse> SetBeamConfigAsync(Guid orgId, string deviceId, BeamConfig config)
    {
        var device = await FindDeviceAsync(orgId, deviceId);
        if (device.Role == DeviceRole.Scoreboard)
            throw new InvalidArgumentException("Only goal counters have a beam");

        // Kept across a reset: the fitted resistors stay with the hardware.
        device.BeamConfig = config == new BeamConfig() ? null : JsonSerializer.Serialize(config, DeviceJson.Options);
        device.ConfigVersion++;
        await dbContext.SaveChangesAsync();
        return MapDevice(device);
    }

    public async Task<EnrolmentTokenStatusResponse> GetEnrolmentTokenStatusAsync(Guid orgId)
    {
        var org = await FindOrganizationAsync(orgId);
        return new EnrolmentTokenStatusResponse
        {
            Exists = org.DeviceEnrolmentTokenHash is not null,
            CreatedAt = org.DeviceEnrolmentTokenCreatedAt,
        };
    }

    public async Task<EnrolmentTokenResponse> RotateEnrolmentTokenAsync(Guid orgId)
    {
        var org = await FindOrganizationAsync(orgId);
        var token = "fbe_" + Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
        org.DeviceEnrolmentTokenHash = DeviceAuthenticationHandler.Hash(token);
        org.DeviceEnrolmentTokenCreatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync();
        return new EnrolmentTokenResponse { Token = token, CreatedAt = org.DeviceEnrolmentTokenCreatedAt.Value };
    }

    public async Task RevokeEnrolmentTokenAsync(Guid orgId)
    {
        var org = await FindOrganizationAsync(orgId);
        org.DeviceEnrolmentTokenHash = null;
        org.DeviceEnrolmentTokenCreatedAt = null;
        await dbContext.SaveChangesAsync();
    }

    private async Task ApplyAsync(Guid orgId, FoosballTable table, UpsertTableRequest request)
    {
        if (!await dbContext.Leagues.AnyAsync(l => l.Id == request.LeagueId && l.OrganizationId == orgId))
        {
            throw new InvalidArgumentException("Choose a league of this organization");
        }

        if (table.LeagueId != request.LeagueId)
        {
            // A live or unclaimed game belongs to the old league; saved matches stay where they were rated.
            var claimFrom = DateTimeOffset.UtcNow - TimeSpan.FromDays(configuration.GetValue("Hardware:ClaimWindowDays", 7));
            if (await dbContext.TableMatches.AnyAsync(m => m.TableId == table.Id &&
                    (m.Status == TableMatchStatus.Live && (m.ScoreA + m.ScoreB > 0 || m.ActiveMatchId != null) ||
                     m.Status == TableMatchStatus.Finished && m.EndedAt >= claimFrom)))
            {
                throw new ConflictException("Finish or discard the current game first");
            }

            // Scanned-in players are the old league's.
            await dbContext.TableRosterEntries.Where(e => e.TableId == table.Id).ExecuteDeleteAsync();
        }

        table.Name = request.Name.Trim();
        table.LeagueId = request.LeagueId;
        table.EndLabelA = string.IsNullOrWhiteSpace(request.EndLabelA) ? FoosballTable.DefaultLabelA : request.EndLabelA.Trim();
        table.EndLabelB = string.IsNullOrWhiteSpace(request.EndLabelB) ? FoosballTable.DefaultLabelB : request.EndLabelB.Trim();
        if (request.SoundVolume is { } volume && volume != table.SoundVolume)
        {
            table.SoundVolume = volume;
            // Devices pull config once per wake; the bump marks the change (as other config changes do).
            await dbContext.Devices.Where(d => d.TableId == table.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.ConfigVersion, d => d.ConfigVersion + 1));
        }
    }

    private async Task<FoosballTable> FindTableAsync(Guid orgId, Guid tableId) =>
        await dbContext.FoosballTables.FirstOrDefaultAsync(t => t.Id == tableId && t.OrganizationId == orgId)
        ?? throw new NotFoundException("Table not found");

    private async Task<Device> FindDeviceAsync(Guid orgId, string deviceId) =>
        await dbContext.Devices.FirstOrDefaultAsync(d => d.HardwareId == deviceId && d.OrganizationId == orgId)
        ?? throw new NotFoundException("Device not found");

    private async Task<Organization> FindOrganizationAsync(Guid orgId) =>
        await dbContext.Organizations.FirstOrDefaultAsync(o => o.Id == orgId)
        ?? throw new NotFoundException("Organization not found");

    private static DeviceResponse MapDevice(Device device) => new()
    {
        Id = device.Id,
        DeviceId = device.HardwareId,
        Claimed = device.Claimed,
        ClaimedAt = device.ClaimedAt,
        Role = device.Role,
        TableId = device.TableId,
        End = device.End,
        LastSeenAt = device.LastSeenAt,
        BatteryMv = device.BatteryMv,
        LowBatt = device.LowBatt,
        FirmwareVersion = device.FirmwareVersion,
        LastStatusAt = device.LastStatusAt,
        LastStatus = device.LastStatus is null ? null : JsonDocument.Parse(device.LastStatus).RootElement.Clone(),
        BeamConfig = device.BeamConfig is null ? null : JsonSerializer.Deserialize<BeamConfig>(device.BeamConfig, DeviceJson.Options),
        CreatedAt = device.CreatedAt,
    };
}

public static class HardwareMapping
{
    /// <summary><c>{Hardware:PublicFrontendBaseUrl}/t/{code}</c>, or null when no base URL is configured.</summary>
    public static string? ShortUrl(IConfiguration configuration, string code)
    {
        var baseUrl = configuration["Hardware:PublicFrontendBaseUrl"]?.TrimEnd('/');
        return string.IsNullOrEmpty(baseUrl) ? null : $"{baseUrl}/t/{code}";
    }

    public static async Task<TableResponse> MapTableAsync(ApiDbContext dbContext, IConfiguration configuration,
        FoosballTable table)
    {
        var scoreboard = await dbContext.Devices.AsNoTracking()
            .Where(d => d.TableId == table.Id && d.Role == DeviceRole.Scoreboard && d.Claimed)
            .Select(d => new { d.End })
            .FirstOrDefaultAsync();

        return new TableResponse
        {
            Id = table.Id,
            Name = table.Name,
            LeagueId = table.LeagueId,
            EndLabelA = table.EndLabelA,
            EndLabelB = table.EndLabelB,
            SoundVolume = table.SoundVolume,
            // The board's left half is the team defending its own end (see TableMatchService).
            ScoreboardLeftEnd = scoreboard?.End,
            HasScoreboard = scoreboard is not null,
            ShortCode = table.ShortCode,
            TableUrl = ShortUrl(configuration, table.ShortCode),
            CreatedAt = table.CreatedAt,
            Occupancy = await TableOccupancy.LoadAsync(dbContext, table, DateTimeOffset.UtcNow),
        };
    }
}
