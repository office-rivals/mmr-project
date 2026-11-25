using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;
using Npgsql;

namespace MMRProject.Api.IntegrationTests.Hardware;

/// <summary>The vendored UI/e2e seed (scripts/seed-data.sql) loads on the current schema and fills the table views.</summary>
[Collection("Database")]
public class SeedDataTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    private const string Org = "/api/v3/organizations/11111111-1111-1111-1111-111111111111";

    [Fact]
    public async Task Seed_GivesEveryTableView_Content()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (!File.Exists(Path.Combine(dir.FullName, "scripts", "seed-data.sql"))) dir = dir.Parent!;
        // psql's \set lines and :'var' substitutions, as seed-local.sh passes them.
        var sql = string.Join('\n', File.ReadAllLines(Path.Combine(dir.FullName, "scripts", "seed-data.sql"))
                .Where(line => !line.StartsWith('\\')))
            .Replace(":'identity_user_id'", "'e2e-test-user'").Replace(":'user_email'", "'e2e@test.local'");
        await using (var connection = new NpgsqlConnection(PostgresFixture.GetConnectionString()))
        {
            await connection.OpenAsync();
            await new NpgsqlCommand(sql, connection).ExecuteNonQueryAsync();
        }

        AuthenticateAs("e2e-test-user");
        var tables = (await ReadJsonAsync<List<TableResponse>>(await Client.GetAsync($"{Org}/tables")))!;
        var (one, two) = (tables.Single(t => t.ShortCode == "table-1"), tables.Single(t => t.ShortCode == "table-2"));
        Assert.Equal(("Red", "White", true), (one.EndLabelA, one.EndLabelB, one.HasScoreboard));
        Assert.Equal(("Blue", "Yellow", false), (two.EndLabelA, two.EndLabelB, two.HasScoreboard));
        Assert.Equal(OccupancyStatus.InUse, one.Occupancy.Status);

        var live = (await ReadJsonAsync<LiveTableResponse>(await Client.GetAsync($"{Org}/tables/{one.Id}/live")))!;
        Assert.Equal((TableMatchStatus.Live, 3, 2), (live.Match!.Status, live.Match.ScoreA, live.Match.ScoreB));
        Assert.Equal(["ok", "low_margin", null], live.Devices.Select(d => d.BeamHealth));
        var finished = (await ReadJsonAsync<LiveTableResponse>(await Client.GetAsync($"{Org}/tables/{two.Id}/live")))!;
        Assert.Equal((TableMatchStatus.Finished, 10, 7), (finished.Match!.Status, finished.Match.ScoreA, finished.Match.ScoreB));
        Assert.Equal(["ambient_high", "blocked"], finished.Devices.Select(d => d.BeamHealth));
        Assert.True(finished.Devices[0].LowBatt);
        Assert.Contains((await ReadJsonAsync<List<TableMatchResponse>>(await Client.GetAsync($"{Org}/table-matches")))!,
            m => m.TableId == two.Id);

        var devices = (await ReadJsonAsync<List<DeviceResponse>>(await Client.GetAsync($"{Org}/admin/devices")))!;
        Assert.Equal(6, devices.Count);
        Assert.Single(devices, d => !d.Claimed);
        Assert.Single(devices, d => d.LastSeenAt < DateTimeOffset.UtcNow.AddHours(-36));

        var link = (await ReadJsonAsync<ShortLinkResponse>(await Client.GetAsync("/api/v3/short-links/table-1")))!;
        Assert.Equal(one.Id, link.TableId);
        var stats = (await ReadJsonAsync<TableStatsResponse>(await Client.GetAsync($"{Org}/tables/{one.Id}/stats")))!;
        Assert.NotEmpty(stats.Weeks);
    }
}
