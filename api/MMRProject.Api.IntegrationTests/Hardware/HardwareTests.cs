using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;
using MMRProject.Api.Services.V3;
using HardwareEntity = MMRProject.Api.Data.Entities.V3.Hardware;

namespace MMRProject.Api.IntegrationTests.Hardware;

[Collection("Database")]
public class HardwareTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task Heartbeat_RequiresHardwareSecretAuthentication()
    {
        AuthenticateAs("user-1");

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest { LocalIpAddress = "192.168.1.42" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Heartbeat_StoresLatestSnapshotForAuthenticatedHardware()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");
        var hardwareId = await SeedHardware(organization.Id, league.Id, "AA:BB:CC:DD:EE:FF");
        AuthenticateAsHardware(hardwareId, organization.Id, league.Id);

        var response = await Client.PostAsJsonAsync(
            "api/v3/hardware/heartbeat",
            new HardwareHeartbeatRequest { LocalIpAddress = " 192.168.1.42 " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var hardware = await dbContext.Hardware.SingleAsync(h => h.Id == hardwareId);

        Assert.Equal("192.168.1.42", hardware.LocalIpAddress);
        Assert.True(hardware.LastSeenAt > DateTimeOffset.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task Register_IssuesSecretForModerator()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");
        await SeedOrgMember(organization.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/hardware",
            new RegisterHardwareRequest { HardwareId = "AA:BB:CC:DD:EE:FF" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync<RegisterHardwareResponse>(response);
        Assert.NotNull(body);
        Assert.StartsWith("hw_", body!.Secret);
        Assert.Equal(organization.Id, body.OrganizationId);
        Assert.Equal(league.Id, body.LeagueId);
    }

    [Fact]
    public async Task Register_RejectsHardwareSecretAuthentication()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");
        var hardwareId = await SeedHardware(organization.Id, league.Id, "AA:BB:CC:DD:EE:FF");
        AuthenticateAsHardware(hardwareId, organization.Id, league.Id);

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/hardware",
            new RegisterHardwareRequest { HardwareId = "11:22:33:44:55:66" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Register_RejectsOrganizationMember()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");
        await SeedOrgMember(organization.Id, "member-1", "member@test.com", OrganizationRole.Member);
        AuthenticateAs("member-1");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{organization.Id}/leagues/{league.Id}/hardware",
            new RegisterHardwareRequest { HardwareId = "AA:BB:CC:DD:EE:FF" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Register_RejectsPatScopedToDifferentOrganization()
    {
        var orgA = await CreateOrganization("Org A", "hardware-pat-org-a");
        var orgB = await CreateOrganization("Org B", "hardware-pat-org-b");
        var leagueB = await CreateLeague(orgB.Id, "League B", "hardware-pat-league-b");
        var user = await SeedUser("moderator-1", "moderator@test.com");
        await SeedExistingUserMembership(orgA.Id, user.Id, OrganizationRole.Moderator);
        await SeedExistingUserMembership(orgB.Id, user.Id, OrganizationRole.Moderator);
        AuthenticateAsPat("moderator-1", "write", orgA.Id);

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgB.Id}/leagues/{leagueB.Id}/hardware",
            new RegisterHardwareRequest { HardwareId = "AA:BB:CC:DD:EE:FF" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RotateSecret_InvalidatesPreviousSecret()
    {
        // Auth in these tests is a claims-injection bypass (see IntegrationTestBase),
        // so real secret validation is exercised directly against IHardwareService.
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");

        using var scope = Factory.Services.CreateScope();
        var hardwareService = scope.ServiceProvider.GetRequiredService<IHardwareService>();

        var registered = await hardwareService.RegisterAsync(
            organization.Id, league.Id, new RegisterHardwareRequest { HardwareId = "AA:BB:CC:DD:EE:FF" });
        Assert.NotNull(await hardwareService.ValidateSecretAsync(registered.Secret));

        var rotated = await hardwareService.RotateSecretAsync(organization.Id, league.Id, registered.Id);

        Assert.Null(await hardwareService.ValidateSecretAsync(registered.Secret));
        Assert.NotNull(await hardwareService.ValidateSecretAsync(rotated.Secret));
    }

    [Fact]
    public async Task Revoke_PreventsFurtherAuthentication()
    {
        var organization = await CreateOrganization("Hardware Org", "hardware-org");
        var league = await CreateLeague(organization.Id, "Hardware League", "hardware-league");

        using var scope = Factory.Services.CreateScope();
        var hardwareService = scope.ServiceProvider.GetRequiredService<IHardwareService>();

        var registered = await hardwareService.RegisterAsync(
            organization.Id, league.Id, new RegisterHardwareRequest { HardwareId = "AA:BB:CC:DD:EE:FF" });

        await hardwareService.RevokeAsync(organization.Id, league.Id, registered.Id);

        Assert.Null(await hardwareService.ValidateSecretAsync(registered.Secret));
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
