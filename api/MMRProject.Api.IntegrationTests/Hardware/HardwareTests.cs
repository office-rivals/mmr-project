using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Auth;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;
using HardwareEntity = MMRProject.Api.Data.Entities.V3.Hardware;

namespace MMRProject.Api.IntegrationTests.Hardware;

[Collection("Database")]
public class HardwareTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task Heartbeat_RequiresPatAuthentication()
    {
        AuthenticateAs("user-1");

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = "AA:BB:CC:DD:EE:FF",
                LeagueId = Guid.NewGuid(),
                LocalIpAddress = "192.168.1.42",
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Heartbeat_StoresLatestSnapshot()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");
        await SeedOrgMember(organization.Id, "hardware-user", "hardware@test.com", OrganizationRole.Owner);
        AuthenticateAsPat("hardware-user", PatScopes.Write);

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = " aa:bb:cc:dd:ee:ff ",
                LeagueId = league.Id,
                LocalIpAddress = " 192.168.1.42 ",
            });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var hardware = await dbContext.Hardware.SingleAsync();

        Assert.Equal("AA:BB:CC:DD:EE:FF", hardware.HardwareId);
        Assert.Equal(organization.Id, hardware.OrganizationId);
        Assert.Equal(league.Id, hardware.LeagueId);
        Assert.Equal("192.168.1.42", hardware.LocalIpAddress);
        Assert.True(hardware.LastSeenAt > DateTimeOffset.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task Heartbeat_UpdatesLeagueAndIpForExistingHardware()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var firstLeague = await CreateLeague(organization.Id, "First League", "first-league");
        var secondLeague = await CreateLeague(organization.Id, "Second League", "second-league");
        await SeedOrgMember(organization.Id, "hardware-user", "hardware@test.com", OrganizationRole.Owner);
        AuthenticateAsPat("hardware-user", PatScopes.Write);

        await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = "AA:BB:CC:DD:EE:FF",
                LeagueId = firstLeague.Id,
                LocalIpAddress = "192.168.1.42",
            });
        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = "aa:bb:cc:dd:ee:ff",
                LeagueId = secondLeague.Id,
                LocalIpAddress = "192.168.1.43",
            });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var hardware = await dbContext.Hardware.SingleAsync();

        Assert.Equal(secondLeague.Id, hardware.LeagueId);
        Assert.Equal("192.168.1.43", hardware.LocalIpAddress);
    }

    [Fact]
    public async Task Heartbeat_UnscopedPatCanTargetAccessibleLeagueAsMember()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-member-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-member-league");
        await SeedTestUser(organization.Id, league.Id, "hardware-user", "hardware@test.com");
        AuthenticateAsPat("hardware-user", PatScopes.Write);

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = "AA:BB:CC:DD:EE:FF",
                LeagueId = league.Id,
                LocalIpAddress = "192.168.1.42",
            });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Heartbeat_UnscopedPatOrganizationMemberWithoutLeagueAccessIsForbidden()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-non-player-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-non-player-league");
        await SeedOrgMember(organization.Id, "hardware-user", "hardware@test.com");
        AuthenticateAsPat("hardware-user", PatScopes.Write);

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = "AA:BB:CC:DD:EE:FF",
                LeagueId = league.Id,
                LocalIpAddress = "192.168.1.42",
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Heartbeat_UnscopedPatCannotTargetLeagueWithoutUserAccess()
    {
        var allowedOrganization = await CreateOrganization("Allowed Hardware Org", "allowed-hardware-org");
        var forbiddenOrganization = await CreateOrganization("Forbidden Hardware Org", "forbidden-hardware-org");
        var forbiddenLeague = await CreateLeague(
            forbiddenOrganization.Id, "Forbidden Hardware League", "forbidden-hardware-league");
        await SeedOrgMember(
            allowedOrganization.Id, "hardware-user", "hardware@test.com", OrganizationRole.Owner);
        AuthenticateAsPat("hardware-user", PatScopes.Write);

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = "AA:BB:CC:DD:EE:FF",
                LeagueId = forbiddenLeague.Id,
                LocalIpAddress = "192.168.1.42",
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Heartbeat_OrganizationScopedPatCannotTargetDifferentOrganization()
    {
        var allowedOrganization = await CreateOrganization("Allowed Hardware Org", "allowed-hardware-org");
        var forbiddenOrganization = await CreateOrganization("Forbidden Hardware Org", "forbidden-hardware-org");
        var forbiddenLeague = await CreateLeague(
            forbiddenOrganization.Id, "Forbidden Hardware League", "forbidden-hardware-league");
        await SeedOrgMember(
            allowedOrganization.Id, "hardware-user", "hardware@test.com", OrganizationRole.Owner);
        AuthenticateAsPat("hardware-user", PatScopes.Write, allowedOrganization.Id);

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = "AA:BB:CC:DD:EE:FF",
                LeagueId = forbiddenLeague.Id,
                LocalIpAddress = "192.168.1.42",
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Heartbeat_LeagueScopedPatCannotTargetSiblingLeague()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var allowedLeague = await CreateLeague(organization.Id, "Allowed League", "allowed-league");
        var forbiddenLeague = await CreateLeague(organization.Id, "Forbidden League", "forbidden-league");
        await SeedOrgMember(organization.Id, "hardware-user", "hardware@test.com", OrganizationRole.Owner);
        AuthenticateAsPat("hardware-user", PatScopes.Write, organization.Id, allowedLeague.Id);

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest
            {
                HardwareId = "AA:BB:CC:DD:EE:FF",
                LeagueId = forbiddenLeague.Id,
                LocalIpAddress = "192.168.1.42",
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task List_ReturnsHardwareStatusForModerator()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");
        await SeedOrgMember(organization.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            dbContext.Hardware.Add(new HardwareEntity
            {
                OrganizationId = organization.Id,
                LeagueId = league.Id,
                HardwareId = "AA:BB:CC:DD:EE:FF",
                LocalIpAddress = "192.168.1.42",
                LastSeenAt = DateTimeOffset.UtcNow.AddMinutes(-16),
            });
            await dbContext.SaveChangesAsync();
        }

        AuthenticateAs("owner-1");
        var response = await Client.GetAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/hardware");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var hardware = Assert.Single((await ReadJsonAsync<List<HardwareResponse>>(response))!);
        Assert.Equal("AA:BB:CC:DD:EE:FF", hardware.HardwareId);
        Assert.Equal("192.168.1.42", hardware.LocalIpAddress);
        Assert.False(hardware.IsOnline);
    }

    [Fact]
    public async Task List_RejectsOrganizationMember()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");
        await SeedOrgMember(organization.Id, "member-1", "member@test.com", OrganizationRole.Member);

        AuthenticateAs("member-1");
        var response = await Client.GetAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/hardware");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
