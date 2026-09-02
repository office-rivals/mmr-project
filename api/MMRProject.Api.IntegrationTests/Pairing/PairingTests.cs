using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Auth;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Pairing;

[Collection("Database")]
public class PairingTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task IssuePairingCode_CalledTwice_ReturnsSameCode()
    {
        await SeedUser("user-1");
        AuthenticateAs("user-1");

        var first = await ReadJsonAsync<PairingCodeResponse>(
            await Client.PostAsync("api/v3/pairing/code", null));
        var second = await ReadJsonAsync<PairingCodeResponse>(
            await Client.PostAsync("api/v3/pairing/code", null));

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(first!.Colors, second!.Colors);
    }

    [Fact]
    public async Task SubmitPairing_WithWrongCode_DoesNotConsumeCode()
    {
        var user = await SeedUser("user-1");
        AuthenticateAs("user-1");

        var issued = await ReadJsonAsync<PairingCodeResponse>(
            await Client.PostAsync("api/v3/pairing/code", null));
        Assert.NotNull(issued);

        AuthenticateAsPat("box-1", PatScopes.Write);
        var wrongColors = issued!.Colors.Select(c => (PairingColor)(((int)c + 1) % 4)).ToList();

        var wrongSubmit = await ReadJsonAsync<PairingSubmitResponse>(
            await Client.PostAsJsonAsync("api/v3/pairing/submit", new PairingSubmitRequest
            {
                RfidUid = "tag-1",
                Colors = wrongColors,
            }));
        Assert.False(wrongSubmit!.Success);

        var correctSubmit = await ReadJsonAsync<PairingSubmitResponse>(
            await Client.PostAsJsonAsync("api/v3/pairing/submit", new PairingSubmitRequest
            {
                RfidUid = "tag-1",
                Colors = issued.Colors,
            }));
        Assert.True(correctSubmit!.Success);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var tag = await dbContext.RfidTags.FirstOrDefaultAsync(t => t.RfidUid == "tag-1");
        Assert.NotNull(tag);
        Assert.Equal(user.Id, tag!.UserId);
    }

    [Fact]
    public async Task SubmitPairing_TagAlreadyPairedToAnotherUser_Rejected()
    {
        var userA = await SeedUser("user-a");
        var userB = await SeedUser("user-b");

        AuthenticateAs("user-a");
        var codeA = await ReadJsonAsync<PairingCodeResponse>(
            await Client.PostAsync("api/v3/pairing/code", null));

        AuthenticateAsPat("box-1", PatScopes.Write);
        await Client.PostAsJsonAsync("api/v3/pairing/submit", new PairingSubmitRequest
        {
            RfidUid = "shared-tag",
            Colors = codeA!.Colors,
        });

        AuthenticateAs("user-b");
        var codeB = await ReadJsonAsync<PairingCodeResponse>(
            await Client.PostAsync("api/v3/pairing/code", null));

        AuthenticateAsPat("box-1", PatScopes.Write);
        var conflictSubmit = await ReadJsonAsync<PairingSubmitResponse>(
            await Client.PostAsJsonAsync("api/v3/pairing/submit", new PairingSubmitRequest
            {
                RfidUid = "shared-tag",
                Colors = codeB!.Colors,
            }));

        Assert.False(conflictSubmit!.Success);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var tag = await dbContext.RfidTags.FirstOrDefaultAsync(t => t.RfidUid == "shared-tag");
        Assert.Equal(userA.Id, tag!.UserId);
        _ = userB;
    }

    [Fact]
    public async Task SubmitPairing_ExpiredCode_Rejected()
    {
        var user = await SeedUser("user-1");

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            dbContext.PairingCodes.Add(new PairingCode
            {
                UserId = user.Id,
                Code = "Red,Green,Blue,Yellow",
                ExpiresAt = DateTimeOffset.UtcNow.AddHours(-1),
            });
            await dbContext.SaveChangesAsync();
        }

        AuthenticateAsPat("box-1", PatScopes.Write);
        var response = await ReadJsonAsync<PairingSubmitResponse>(
            await Client.PostAsJsonAsync("api/v3/pairing/submit", new PairingSubmitRequest
            {
                RfidUid = "tag-expired",
                Colors = [PairingColor.Red, PairingColor.Green, PairingColor.Blue, PairingColor.Yellow],
            }));

        Assert.False(response!.Success);
    }

    [Fact]
    public async Task ListAndUnlinkTags_ScopedToCurrentUser()
    {
        await SeedUser("user-1");
        AuthenticateAs("user-1");

        var issued = await ReadJsonAsync<PairingCodeResponse>(
            await Client.PostAsync("api/v3/pairing/code", null));

        AuthenticateAsPat("box-1", PatScopes.Write);
        await Client.PostAsJsonAsync("api/v3/pairing/submit", new PairingSubmitRequest
        {
            RfidUid = "tag-1",
            Colors = issued!.Colors,
        });

        AuthenticateAs("user-1");
        var tags = await ReadJsonAsync<List<RfidTagResponse>>(await Client.GetAsync("api/v3/pairing/tags"));
        Assert.NotNull(tags);
        var tag = Assert.Single(tags!);
        Assert.Equal("tag-1", tag.RfidUid);

        var deleteResponse = await Client.DeleteAsync($"api/v3/pairing/tags/{tag.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var tagsAfterDelete = await ReadJsonAsync<List<RfidTagResponse>>(await Client.GetAsync("api/v3/pairing/tags"));
        Assert.Empty(tagsAfterDelete!);
    }

    [Fact]
    public async Task IssuePairingCode_AsPatAuthenticatedCaller_Forbidden()
    {
        await SeedUser("box-1");
        AuthenticateAsPat("box-1", PatScopes.Write);

        var response = await Client.PostAsync("api/v3/pairing/code", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
