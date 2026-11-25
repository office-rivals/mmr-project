using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.BackgroundServices;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.IntegrationTests.Fixtures;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.IntegrationTests.Hardware;

[Collection("Database")]
public class HardwareTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    private record TestDevice(string Id, string Secret)
    {
        public static TestDevice New() =>
            new($"fb-{Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(6))}",
                Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32)));
    }

    private record TestTable(Organization Org, League League, Guid TableId, string Token)
    {
        public string Admin => $"api/v3/organizations/{Org.Id}/admin";
    }

    // ---- Device auth ----

    [Fact]
    public async Task DeviceAuth_EnrolsWithToken_AndKnownDevicesIgnoreTheToken()
    {
        var t = await SetupTableAsync();
        var device = TestDevice.New();

        Assert.Equal(HttpStatusCode.Unauthorized, (await GetConfig(device, token: null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetConfig(device, token: "fbe_wrong")).StatusCode);

        // Valid token: registered as unclaimed → config 404.
        Assert.Equal(HttpStatusCode.NotFound, (await GetConfig(device, t.Token)).StatusCode);
        var devices = await ReadJsonAsync<List<DeviceResponse>>(await Client.GetAsync($"{t.Admin}/devices"));
        Assert.Contains(devices!, d => d.DeviceId == device.Id && !d.Claimed);

        // Same id, different secret (e.g. someone else) → 401, even with the token.
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await GetConfig(device with { Secret = TestDevice.New().Secret }, t.Token)).StatusCode);

        // Revoking the token doesn't lock out a registered device.
        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync($"{t.Admin}/device-enrolment-token")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await GetConfig(device, token: null)).StatusCode);

        // After a reset the device must enrol again (needs a valid token).
        Assert.Equal(HttpStatusCode.OK, (await Client.PostAsync($"{t.Admin}/devices/{device.Id}/reset", null)).StatusCode);
        var wiped = device with { Secret = TestDevice.New().Secret };
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetConfig(wiped, t.Token)).StatusCode);
        var newToken = await RotateTokenAsync(t.Org.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await GetConfig(wiped, newToken)).StatusCode);
    }

    [Fact]
    public async Task Config_ReturnsAssignment()
    {
        var t = await SetupTableAsync();
        var goal = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);

        var response = await GetConfig(goal, t.Token);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var config = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("goal", config.GetProperty("role").GetString());
        Assert.Equal(t.TableId.ToString(), config.GetProperty("table_id").GetString());
        Assert.Equal("B", config.GetProperty("goal").GetString());
        Assert.Equal(1, config.GetProperty("config_version").GetInt32());

        // A second goal counter on the same goal is refused.
        var other = TestDevice.New();
        await GetConfig(other, t.Token);
        var conflict = await Client.PutAsJsonAsync($"{t.Admin}/devices/{other.Id}",
            new AssignDeviceRequest { Role = DeviceRole.Goal, TableId = t.TableId, End = TableEnd.B });
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task SoundVolume_DefaultsToMedium_AndIsSetPerTable()
    {
        var t = await SetupTableAsync();
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        async Task<JsonElement> Config() =>
            JsonDocument.Parse(await (await GetConfig(board, t.Token)).Content.ReadAsStringAsync()).RootElement;
        Task<HttpResponseMessage> Put(int? volume) => Client.PutAsJsonAsync($"{t.Admin}/tables/{t.TableId}",
            new UpsertTableRequest { Name = "Table 1", LeagueId = t.League.Id, SoundVolume = volume });

        var before = await Config();
        Assert.Equal(2, before.GetProperty("sound_volume").GetInt32());

        var muted = await Put(0);
        Assert.Equal(0, (await ReadJsonAsync<TableResponse>(muted))!.SoundVolume);
        var after = await Config();
        Assert.Equal(0, after.GetProperty("sound_volume").GetInt32());
        Assert.True(after.GetProperty("config_version").GetInt32() > before.GetProperty("config_version").GetInt32());

        // Omitted leaves it unchanged; out of range is refused.
        Assert.Equal(0, (await ReadJsonAsync<TableResponse>(await Put(null)))!.SoundVolume);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(4)).StatusCode);
        Assert.Equal(0, (await Config()).GetProperty("sound_volume").GetInt32());
    }

    [Fact]
    public async Task BeamConfig_IsServedToTheGoalCounter_AndABeamStatusKeepsItAwake()
    {
        var t = await SetupTableAsync();
        var goal = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        async Task<JsonElement> Config() =>
            JsonDocument.Parse(await (await GetConfig(goal, t.Token)).Content.ReadAsStringAsync()).RootElement;
        Task<HttpResponseMessage> Put(TestDevice device, BeamConfig config) =>
            Client.PutAsJsonAsync($"{t.Admin}/devices/{device.Id}/beam-config", config);
        bool AnyBeamKey(JsonElement config) => config.EnumerateObject().Any(p => p.Name.StartsWith("beam_"));

        var before = await Config();
        Assert.False(AnyBeamKey(before));

        var set = await ReadJsonAsync<DeviceResponse>(await Put(goal,
            new BeamConfig { Mode = BeamMode.ABoost, CheckS = 30, MarginMin = 2.5, RPuAOhm = 220_000, LedMa = [1.0, 4.5] }));
        Assert.Equal((BeamMode.ABoost, 30), (set!.BeamConfig!.Mode, set.BeamConfig.CheckS));
        var after = await Config();
        Assert.Equal("a_boost", after.GetProperty("beam_mode").GetString());
        Assert.Equal(30, after.GetProperty("beam_check_s").GetInt32());
        Assert.Equal(2.5, after.GetProperty("beam_margin_min").GetDouble());
        Assert.Equal(220_000, after.GetProperty("beam_r_pu_a_ohm").GetDouble());
        Assert.Equal([1.0, 4.5], after.GetProperty("beam_led_ma").EnumerateArray().Select(e => e.GetDouble()));
        Assert.False(after.TryGetProperty("beam_settle_ms", out _));
        Assert.True(after.GetProperty("config_version").GetInt32() > before.GetProperty("config_version").GetInt32());

        // Out of range is refused; a scoreboard has no beam; a reset keeps it (the resistors stay fitted).
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(goal, new BeamConfig { CheckS = 5 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(goal, new BeamConfig { LedMa = [1.0] })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(board, new BeamConfig { Mode = BeamMode.B })).StatusCode);
        var reset = await ReadJsonAsync<DeviceResponse>(await Client.PostAsync($"{t.Admin}/devices/{goal.Id}/reset", null));
        Assert.Equal(BeamMode.ABoost, reset!.BeamConfig!.Mode);
        Assert.Equal(HttpStatusCode.NotFound, (await GetConfig(goal, t.Token)).StatusCode);
        await Client.PutAsJsonAsync($"{t.Admin}/devices/{goal.Id}",
            new AssignDeviceRequest { Role = DeviceRole.Goal, TableId = t.TableId, End = TableEnd.A });
        Assert.Equal("a_boost", (await Config()).GetProperty("beam_mode").GetString());

        // Empty = every field back to the firmware default.
        Assert.Null((await ReadJsonAsync<DeviceResponse>(await Put(goal, new BeamConfig())))!.BeamConfig);
        Assert.False(AnyBeamKey(await Config()));

        // A beam status comes mid-wake: the device stays awake, and the admin sees its beam object.
        Assert.Equal(HttpStatusCode.NoContent, (await PostStatusAsync(board, t, "scoreboard", "sleep", 60_000)).StatusCode);
        var status = await DeviceSend(goal, t, HttpMethod.Post, $"devices/{goal.Id}/status", new
        {
            device_id = goal.Id, role = "goal", reason = "beam", battery_mv = 3900, firmware_version = "0.1.0",
            uptime_ms = 60_000, queued_events = 0, dropped_events = 0, beam_blocked = false, low_batt = false,
            metrics = new { reset_reason = "deepsleep" },
            beam = new { health = "ambient_high", mode = "a", amb_ua = 3.1, lit1_ua = 40.0, margin = 12.9, ball_ua = 3.4,
                baseline_amb_ua = 0.4, baseline_lit1_ua = 41.0, checked_s = 2 },
        });
        Assert.Equal(HttpStatusCode.NoContent, status.StatusCode);
        Assert.Equal(OccupancyReason.Touched, (await OccupancyAsync(t)).Reason);
        var devices = await ReadJsonAsync<List<DeviceResponse>>(await Client.GetAsync($"{t.Admin}/devices"));
        var listed = devices!.Single(d => d.DeviceId == goal.Id);
        Assert.Equal("ambient_high", listed.LastStatus!.Value.GetProperty("beam").GetProperty("health").GetString());
        using var scope = Factory.Services.CreateScope();
        Assert.NotNull((await scope.ServiceProvider.GetRequiredService<ApiDbContext>().Devices
            .SingleAsync(d => d.HardwareId == goal.Id)).AwakeSince);
    }

    [Fact]
    public async Task Live_LongPollsOnTheVersion_LikeTheScoreboard()
    {
        var t = await SetupTableAsync();
        var goal = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var live = $"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/live";
        var first = (await ReadJsonAsync<LiveTableResponse>(await Client.GetAsync(live)))!;

        // An older version answers at once; the current one is held, and still answered when nothing changes.
        var stale = Stopwatch.StartNew();
        Assert.Equal(first.Version, (await ReadJsonAsync<LiveTableResponse>(await Client.GetAsync($"{live}?since={first.Version - 1}&wait=10")))!.Version);
        Assert.True(stale.Elapsed < TimeSpan.FromSeconds(2));
        var quiet = Stopwatch.StartNew();
        Assert.Equal(first.Version, (await ReadJsonAsync<LiveTableResponse>(await Client.GetAsync($"{live}?since={first.Version}&wait=1")))!.Version);
        Assert.True(quiet.Elapsed >= TimeSpan.FromSeconds(0.9));

        // A goal wakes a held poll at once.
        var poll = Client.GetAsync($"{live}?since={first.Version}&wait=20");
        await Task.Delay(300);
        Assert.False(poll.IsCompleted);
        var woken = Stopwatch.StartNew();
        Assert.Equal(HttpStatusCode.Created, (await PostGoal(goal, t, 1)).StatusCode);
        var changed = (await ReadJsonAsync<LiveTableResponse>(await poll))!;
        Assert.True(woken.Elapsed < TimeSpan.FromSeconds(3));
        Assert.True(changed.Version > first.Version);
        Assert.Equal(1, changed.Match!.ScoreB);

        // A table outside the org: 404 before any wait.
        var unknown = Stopwatch.StartNew();
        Assert.Equal(HttpStatusCode.NotFound,
            (await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables/{Guid.NewGuid()}/live?since=0&wait=10")).StatusCode);
        Assert.True(unknown.Elapsed < TimeSpan.FromSeconds(2));
    }

    [Fact]
    public async Task Phone_StartsGames_RecordingTheMember_AndSeesTheDevices()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        var live = $"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}";
        async Task<LiveTableResponse> Live() => (await ReadJsonAsync<LiveTableResponse>(await Client.GetAsync($"{live}/live")))!;
        Task<HttpResponseMessage> NewGame(bool save, long version) =>
            Client.PostAsJsonAsync($"{live}/new-game", new TableNewGameRequest { Save = save, ExpectedVersion = version });
        Guid ownerMembership;
        using (var scope = Factory.Services.CreateScope())
        {
            ownerMembership = await scope.ServiceProvider.GetRequiredService<ApiDbContext>().OrganizationMemberships
                .Where(m => m.OrganizationId == t.Org.Id && m.Role == OrganizationRole.Owner).Select(m => m.Id).SingleAsync();
        }

        // No board; both counters listed with their end, no status yet.
        var empty = await Live();
        Assert.False(empty.Table.HasScoreboard);
        Assert.Equal([(DeviceRole.Goal, TableEnd.A), (DeviceRole.Goal, TableEnd.B)], empty.Devices.Select(d => (d.Role, d.End!.Value)));
        Assert.All(empty.Devices, d => Assert.Null(d.BeamHealth));
        await PostStatusAsync(goalB, t, "goal", "heartbeat", 900);
        Assert.Equal("ok", (await Live()).Devices.Single(d => d.End == TableEnd.B).BeamHealth);

        await PostGoal(goalA, t, 1);
        var version = (await Live()).Version;
        Assert.Equal(HttpStatusCode.Conflict, (await NewGame(true, version - 1)).StatusCode);
        var saved = (await ReadJsonAsync<LiveTableResponse>(await NewGame(true, version)))!;
        Assert.Equal(TableMatchStatus.Finished, saved.Match!.Status);
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            Assert.Equal(ownerMembership, (await db.TableMatches.SingleAsync(m => m.TableId == t.TableId)).EndedByMembershipId);
        }

        // The sticker opens the live page for 2 min after the end (the result first), then the claim page.
        var resolve = $"api/v3/short-links/{saved.Table.ShortCode}";
        Assert.Equal($"/{t.Org.Slug}/{t.League.Slug}/tables/{t.TableId}", (await ReadJsonAsync<ShortLinkResponse>(await Client.GetAsync(resolve)))!.Path);
        using (var scope = Factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<ApiDbContext>().TableMatches.Where(m => m.TableId == t.TableId)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.EndedAt, m => m.EndedAt!.Value.AddMinutes(-3)));
        }

        Assert.StartsWith($"/{t.Org.Slug}/{t.League.Slug}/submit?table={t.TableId}&match=",
            (await ReadJsonAsync<ShortLinkResponse>(await Client.GetAsync(resolve)))!.Path);

        // A board on the table; team names default to Red / White and must differ.
        await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        Assert.True((await Live()).Table.HasScoreboard);
        var renamed = await ReadJsonAsync<TableResponse>(await Client.PutAsJsonAsync($"{t.Admin}/tables/{t.TableId}",
            new UpsertTableRequest { Name = "Table 1", LeagueId = t.League.Id }));
        Assert.Equal(("Red", "White"), (renamed!.EndLabelA, renamed.EndLabelB));
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PutAsJsonAsync($"{t.Admin}/tables/{t.TableId}",
            new UpsertTableRequest { Name = "Table 1", LeagueId = t.League.Id, EndLabelA = "white " })).StatusCode);
    }

    [Fact]
    public async Task UndoEvents_UndoOnlyTheCountersOwnGoal_WithinTheWindow_RetriesDedupedFirst()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        string Goal(TestDevice d, int seq) => $"{d.Id}-0000beef-{seq}";
        Task<HttpResponseMessage> UndoEvent(TestDevice d, int seq, int undoesSeq, TestDevice? owner = null) =>
            DeviceSend(d, t, HttpMethod.Post, "undo-events", new
            {
                event_id = Goal(d, seq), device_id = d.Id, seq, occurred_at = (DateTimeOffset?)null, uptime_ms = 1000 * seq,
                table_id = t.TableId.ToString(), goal = (string?)null, undoes_event_id = Goal(owner ?? d, undoesSeq),
                battery_mv = 3900, firmware_version = "0.1.0",
            });
        async Task<string?> Refusal(HttpResponseMessage response)
        {
            Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString();
        }

        async Task AgeGoal(TestDevice d, int seq, int seconds)
        {
            var eventId = Goal(d, seq);
            using var scope = Factory.Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ApiDbContext>().TableGoals.Where(g => g.EventId == eventId)
                .ExecuteUpdateAsync(s => s.SetProperty(g => g.ReceivedAt, g => g.ReceivedAt.AddSeconds(-seconds)));
        }

        async Task<int> Score() => (await ReadJsonAsync<LiveTableResponse>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/live")))!.Match!.ScoreB;

        Assert.Equal(10, JsonDocument.Parse(await (await GetConfig(goalA, t.Token)).Content.ReadAsStringAsync())
            .RootElement.GetProperty("undo_window_s").GetInt32());

        // A 201 carries the match's score for the counter's screen; end A's goal scores for B.
        Assert.Equal("""{"score_a":0,"score_b":1,"label_a":"Window","label_b":"Door","status":"live","scores_for":"b"}""",
            await (await PostGoal(goalA, t, 1)).Content.ReadAsStringAsync());
        Assert.Equal("not_yours", await Refusal(await UndoEvent(goalB, 1, 1, owner: goalA)));
        Assert.Equal("not_yours", await Refusal(await UndoEvent(goalA, 2, 99)));
        var undone = await UndoEvent(goalA, 3, 1);
        Assert.Equal(HttpStatusCode.Created, undone.StatusCode);
        Assert.Equal("""{"score_a":0,"score_b":0,"label_a":"Window","label_b":"Door","status":"live","scores_for":"b"}""",
            await undone.Content.ReadAsStringAsync());
        Assert.Equal(0, await Score());
        // The retry of an undo that worked: 409 (done), even once the window has passed.
        await AgeGoal(goalA, 1, 60);
        Assert.Equal(HttpStatusCode.Conflict, (await UndoEvent(goalA, 3, 1)).StatusCode);
        Assert.Equal("already_undone", await Refusal(await UndoEvent(goalA, 4, 1)));

        await PostGoal(goalA, t, 5);
        await AgeGoal(goalA, 5, 11);
        Assert.Equal("too_late", await Refusal(await UndoEvent(goalA, 6, 5)));
        Assert.Equal(1, await Score());

        await PostGoal(goalA, t, 7);
        var version = (await ReadJsonAsync<LiveTableResponse>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/live")))!.Version;
        await Client.PostAsJsonAsync($"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/new-game",
            new TableNewGameRequest { Save = false, ExpectedVersion = version });
        Assert.Equal("closed", await Refusal(await UndoEvent(goalA, 8, 7)));
    }

    [Theory]
    [InlineData(TableEnd.A)]
    [InlineData(TableEnd.B)]
    public async Task Scoreboard_ShowsDefendersOfItsEndOnTheLeft(TableEnd boardEnd)
    {
        var t = await SetupTableAsync();
        // A ball into goal B scores for team A.
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, boardEnd);
        await PostGoal(goalB, t, 1);

        var match = (await GetBoard(board, t)).Match!;
        var teamA = boardEnd == TableEnd.A ? match.Left : match.Right;
        var teamB = boardEnd == TableEnd.A ? match.Right : match.Left;
        Assert.Equal((1, "Window"), (teamA.Score, teamA.EndLabel));
        Assert.Equal((0, "Door"), (teamB.Score, teamB.EndLabel));

        var tables = await ReadJsonAsync<List<TableResponse>>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables"));
        Assert.Equal(boardEnd, Assert.Single(tables!).ScoreboardLeftEnd);
    }

    // ---- Unclaimed match ----

    [Fact]
    public async Task UnclaimedMatch_ScoresFinishesAndIsClaimed()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);

        // Goal A conceded → team B scores; event_id dedupes.
        Assert.Equal(HttpStatusCode.Created, (await PostGoal(goalA, t, 1)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await PostGoal(goalA, t, 1)).StatusCode);

        var state = await GetBoard(board, t);
        var match = state.Match!;
        Assert.Equal("live", match.Status);
        // Board at end A: team A (defending A) on the left.
        Assert.Equal(0, match.Left.Score);
        Assert.Equal(1, match.Right.Score);
        Assert.Equal("Window", match.Left.EndLabel);
        Assert.Equal("Door", match.Right.EndLabel);
        Assert.Equal("right", match.LastGoal!.Side);
        Assert.Empty(match.Right.Players);
        Assert.False(state.NeedsClaim);

        for (var seq = 2; seq <= 10; seq++)
        {
            Assert.Equal(HttpStatusCode.Created, (await PostGoal(goalA, t, seq)).StatusCode);
        }

        state = await GetBoard(board, t);
        Assert.Equal("finished", state.Match!.Status);
        Assert.Equal("right", state.Match.Winner);
        Assert.True(state.NeedsClaim);

        var claimable = await ReadJsonAsync<List<TableMatchResponse>>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/table-matches?tableId={t.TableId}"));
        var tableMatch = Assert.Single(claimable!);
        Assert.Equal((0, 10), (tableMatch.ScoreA, tableMatch.ScoreB));

        var players = await SeedPlayersAsync(t, "a1", "a2", "b1", "b2");
        var claim = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/table-matches/{tableMatch.Id}/claim",
            new ClaimTableMatchRequest
            {
                Teams =
                [
                    new ClaimTableMatchTeamRequest { End = TableEnd.B, Players = [players[2], players[3]] },
                    new ClaimTableMatchTeamRequest { End = TableEnd.A, Players = [players[0], players[1]] },
                ],
            });
        Assert.Equal(HttpStatusCode.OK, claim.StatusCode);
        var created = await ReadJsonAsync<MatchResponse>(claim);
        Assert.Equal(MatchSource.Table, created!.Source);
        var teamB = created.Teams.Single(team => team.Score == 10);
        Assert.Equal(new[] { players[2], players[3] }.Order(), teamB.Players.Select(p => p.LeaguePlayerId).Order());

        Assert.False((await GetBoard(board, t)).NeedsClaim);
        var live = await ReadJsonAsync<LiveTableResponse>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/live"));
        Assert.Equal(TableMatchStatus.Submitted, live!.Match!.Status);
        Assert.Equal(created.Id, live.PreviousMatch!.MatchId);
        Assert.Equal(players[0..2].Order(), live.PreviousMatch.PlayersA.Select(p => p.LeaguePlayerId).Order());

        // Claiming twice is refused.
        var again = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/table-matches/{tableMatch.Id}/claim",
            new ClaimTableMatchRequest());
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task GoalsThatFitNoMatch_AreKeptAsOrphans()
    {
        var t = await SetupTableAsync();
        var unclaimed = TestDevice.New();
        await GetConfig(unclaimed, t.Token);
        // An orphan's 201 has no score.
        var orphan = await PostGoal(unclaimed, t, 1, tableId: null);
        Assert.Equal((HttpStatusCode.Created, ""), (orphan.StatusCode, await orphan.Content.ReadAsStringAsync()));

        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        // Queued for hours, no match it could belong to.
        var noMatch = await PostGoal(goalA, t, 1, occurredAt: DateTimeOffset.UtcNow.AddHours(-2));
        Assert.Equal((HttpStatusCode.Created, ""), (noMatch.StatusCode, await noMatch.Content.ReadAsStringAsync()));
        Assert.Null((await GetBoard(board, t)).Match);

        AuthenticateAs("owner");
        var orphans = await ReadJsonAsync<List<OrphanGoalResponse>>(await Client.GetAsync($"{t.Admin}/orphan-goals"));
        Assert.Equal(2, orphans!.Count);
        Assert.Contains(orphans, o => o.DeviceId == unclaimed.Id && o.Reason == OrphanReason.UnassignedDevice);
        var queued = Assert.Single(orphans, o => o.DeviceId == goalA.Id);
        Assert.Equal((OrphanReason.NoMatch, t.TableId, TableEnd.B), (queued.Reason, queued.TableId, queued.End));
    }

    [Theory]
    [InlineData(5)]
    [InlineData(-5)]
    [InlineData(null)]
    public async Task SkewedOrUnsyncedClocks_StillCountEveryGoal(int? skewSeconds)
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        DateTimeOffset? Skewed() => skewSeconds is { } s ? DateTimeOffset.UtcNow.AddSeconds(s) : null;

        // The first goal at each end of a fresh match, the other device's clock off the other way.
        await PostGoal(goalA, t, 1, occurredAt: Skewed(), nullOccurredAt: skewSeconds is null);
        await PostGoal(goalB, t, 1, occurredAt: skewSeconds is { } s1 ? DateTimeOffset.UtcNow.AddSeconds(-s1) : null,
            nullOccurredAt: skewSeconds is null);
        Assert.Equal((1, 1), ((await GetBoard(board, t)).Match!.Left.Score, (await GetBoard(board, t)).Match!.Right.Score));

        // A match started by "New game" (server time), then a goal from a skewed device.
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        await PostGoal(goalA, t, 2, occurredAt: Skewed(), nullOccurredAt: skewSeconds is null);
        var match = (await GetBoard(board, t)).Match!;
        Assert.Equal(("live", 0, 1), (match.Status, match.Left.Score, match.Right.Score));
    }

    [Fact]
    public async Task OfflineQueuedGoals_ArrivingAfterNewGame_GoToTheirOwnMatch()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);

        // Game 1 (10 to 5 minutes ago): one goal arrives, goal B's device is offline.
        await PostGoal(goalA, t, 1);
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        await ShiftMatchesAsync(TimeSpan.FromMinutes(-5), TimeSpan.FromMinutes(-10));
        // Game 2 starts now.
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        await PostGoal(goalA, t, 2);

        // Goal B's device comes back with a goal it queued during game 1.
        // Its score is game 1's, where it landed.
        var queued = await PostGoal(goalB, t, 1, occurredAt: DateTimeOffset.UtcNow.AddMinutes(-7));
        Assert.Equal(HttpStatusCode.Created, queued.StatusCode);
        Assert.Equal("""{"score_a":1,"score_b":1,"label_a":"Window","label_b":"Door","status":"finished","scores_for":"a"}""",
            await queued.Content.ReadAsStringAsync());

        var live = (await GetBoard(board, t)).Match!;
        Assert.Equal((0, 1), (live.Left.Score, live.Right.Score));
        var finished = Assert.Single(await ReadJsonAsync<List<TableMatchResponse>>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/table-matches?tableId={t.TableId}")) ?? []);
        Assert.Equal((1, 1), (finished.ScoreA, finished.ScoreB));
        Assert.Empty((await ReadJsonAsync<List<OrphanGoalResponse>>(await Client.GetAsync($"{t.Admin}/orphan-goals")))!);
    }

    [Fact]
    public async Task SimultaneousFirstGoals_AtBothEnds_OpenOneMatch()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);

        for (var round = 1; round <= 10; round++)
        {
            var at = DateTimeOffset.UtcNow;
            var responses = await Task.WhenAll(
                PostGoal(goalA, t, round, occurredAt: at),
                PostGoal(goalB, t, round, occurredAt: at));
            Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));

            var match = (await GetBoard(board, t)).Match!;
            Assert.Equal((1, 1), (match.Left.Score, match.Right.Score));

            await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = false });
        }

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(20, await dbContext.TableGoals.CountAsync(g => g.TableMatchId != null));
        Assert.Equal(10, await dbContext.TableMatches.CountAsync());
    }

    // ---- Scoreboard actions ----

    [Fact]
    public async Task Undo_IsGuardedByExpectedVersion()
    {
        var t = await SetupTableAsync();
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        await PostGoal(goalB, t, 1);
        var version = (await GetBoard(board, t)).Version;

        var undo = await PostAction(board, t, new { type = "undo_last_goal", expected_version = version });
        Assert.Equal(HttpStatusCode.OK, undo.StatusCode);
        var undone = await ReadDeviceJson<ScoreboardStateResponse>(undo);
        Assert.Equal(0, undone.Match!.Left.Score);
        Assert.False(undone.Match.CanUndo);

        // A retry of the same press undoes nothing more.
        var retry = await PostAction(board, t, new { type = "undo_last_goal", expected_version = version });
        Assert.Equal(HttpStatusCode.Conflict, retry.StatusCode);
        Assert.Equal(0, (await ReadDeviceJson<ScoreboardStateResponse>(retry)).Match!.Left.Score);

        var nothing = await PostAction(board, t, new { type = "undo_last_goal", expected_version = undone.Version });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, nothing.StatusCode);
    }

    [Fact]
    public async Task NewGame_SaveFinishes_DiscardClears()
    {
        var t = await SetupTableAsync();
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);

        await PostGoal(goalB, t, 1);
        var saved = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t,
            new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true }));
        Assert.Equal("finished", saved.Match!.Status);
        Assert.Equal(1, saved.Match.Left.Score);
        Assert.True(saved.NeedsClaim);

        var fresh = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t,
            new { type = "new_game", expected_version = saved.Version, save = true }));
        // A table that can scan players in goes back to the lobby: no match until the next goal.
        Assert.Null(fresh.Match);
        Assert.False(fresh.NeedsClaim);
        Assert.NotNull(fresh.Roster);

        await PostGoal(goalB, t, 2);
        var discarded = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t,
            new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = false }));
        Assert.Null(discarded.Match);
    }

    [Fact]
    public async Task Tables_BelongToOneLeague_AndRateOnlyThere()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var other = await CreateLeague(t.Org.Id, "Singles", "singles", teamSize: 1);
        await CreateSeason(t.Org.Id, other.Id);
        var foreign = await CreateLeague((await CreateOrganization("Elsewhere", "elsewhere")).Id);
        var table = $"{t.Admin}/tables/{t.TableId}";
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PostAsJsonAsync($"{t.Admin}/tables",
            new UpsertTableRequest { Name = "Table 2", LeagueId = foreign.Id })).StatusCode);

        // A game being played keeps the league; a claim names the table's league.
        await PostGoal(goalA, t, 1);
        Assert.Equal(HttpStatusCode.Conflict,
            (await Client.PutAsJsonAsync(table, new UpsertTableRequest { Name = "Table 1", LeagueId = other.Id })).StatusCode);
        var live = (await ReadJsonAsync<LiveTableResponse>(await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/live")))!;
        var players = await SeedPlayersAsync(t with { League = other }, "a1", "b1");
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PostAsJsonAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{other.Id}/table-matches/{live.Match!.Id}/claim",
            new ClaimTableMatchRequest
            {
                Teams =
                [
                    new ClaimTableMatchTeamRequest { End = TableEnd.A, Players = [players[0]] },
                    new ClaimTableMatchTeamRequest { End = TableEnd.B, Players = [players[1]] },
                ],
            })).StatusCode);

        // An unclaimed game keeps it too; once rated (in the table's league), the table can move.
        for (var seq = 2; seq <= 10; seq++) await PostGoal(goalA, t, seq);
        Assert.Equal(HttpStatusCode.Conflict,
            (await Client.PutAsJsonAsync(table, new UpsertTableRequest { Name = "Table 1", LeagueId = other.Id })).StatusCode);
        var own = await SeedPlayersAsync(t, "c1", "c2", "d1", "d2");
        var rated = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/table-matches/{live.Match.Id}/claim",
            new ClaimTableMatchRequest
            {
                Teams =
                [
                    new ClaimTableMatchTeamRequest { End = TableEnd.A, Players = [own[0], own[1]] },
                    new ClaimTableMatchTeamRequest { End = TableEnd.B, Players = [own[2], own[3]] },
                ],
            });
        Assert.Equal((HttpStatusCode.OK, t.League.Id), (rated.StatusCode, (await ReadJsonAsync<MatchResponse>(rated))!.LeagueId));
        var moved = await Client.PutAsJsonAsync(table, new UpsertTableRequest { Name = "Table 1", LeagueId = other.Id });
        Assert.Equal(other.Id, (await ReadJsonAsync<TableResponse>(moved))!.LeagueId);
    }

    // ---- Linked active match ----

    [Fact]
    public async Task LinkedMatch_ShowsRoster_SwapsSides_AndIsSubmittedOnConfirm()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        var activeMatch = await CreateActiveMatchAsync(t);

        AuthenticateAs("p1");
        var link = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/active-matches/{activeMatch.Id}/link-table",
            new LinkTableRequest { TableId = t.TableId, TeamIndexAtEndA = 0 });
        Assert.Equal(HttpStatusCode.OK, link.StatusCode);

        var state = await GetBoard(board, t);
        var team0 = activeMatch.Teams.Single(team => team.Index == 0).Players.Select(p => p.LeaguePlayerId.ToString());
        var team1 = activeMatch.Teams.Single(team => team.Index == 1).Players.Select(p => p.LeaguePlayerId.ToString());
        Assert.True(state.Match!.CanSwap);
        Assert.Equal(team0.Order(), state.Match.Left.Players.Select(p => p.Id).Order());

        var swapped = await ReadDeviceJson<ScoreboardStateResponse>(
            await PostAction(board, t, new { type = "swap_sides", expected_version = state.Version }));
        Assert.Equal(team1.Order(), swapped.Match!.Left.Players.Select(p => p.Id).Order());

        // Goals into goal A score for end B = team 0 after the swap.
        for (var seq = 1; seq <= 10; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        state = await GetBoard(board, t);
        Assert.Equal("finished", state.Match!.Status);
        Assert.False(state.Match.CanSwap);
        Assert.True(state.NeedsClaim);

        // Assign the scorer of the last goal (own goal when it's a player of the conceding team).
        var scorer = team1.First();
        var assigned = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t, new
        {
            type = "assign_scorer", expected_version = state.Version, goal_id = state.Match.LastGoal!.Id,
            player_id = scorer,
        }));
        Assert.Equal(scorer, assigned.Match!.LastGoal!.Scorer!.Id);
        Assert.True(assigned.Match.LastGoal.OwnGoal);

        // Not auto-submitted: the active match still exists until the players confirm.
        Assert.NotEmpty(await ListActiveMatchesAsync(t));

        var confirmed = await PostAction(board, t,
            new { type = "new_game", expected_version = assigned.Version, save = true });
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        // Confirming is also a rematch: the same teams at 0 : 0, in a new active match.
        var rematch = await ReadDeviceJson<ScoreboardStateResponse>(confirmed);
        Assert.Equal(("live", 0, 0), (rematch.Match!.Status, rematch.Match.Left.Score, rematch.Match.Right.Score));
        Assert.NotEqual(activeMatch.Id, Assert.Single(await ListActiveMatchesAsync(t)).Id);

        var matches = await ReadJsonAsync<List<MatchResponse>>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/matches"));
        var submitted = Assert.Single(matches!);
        Assert.Equal(MatchSource.Table, submitted.Source);
        Assert.Equal(team0.Order(), submitted.Teams.Single(team => team.Score == 10).Players
            .Select(p => p.LeaguePlayerId.ToString()).Order());
    }

    // ---- Long-poll, idle, short links ----

    [Fact]
    public async Task LongPoll_Returns304OnTimeout_AndWakesOnGoal()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        var version = (await GetBoard(board, t)).Version;

        var timeout = await DeviceSend(board, t, HttpMethod.Get,
            $"devices/{board.Id}/scoreboard?since={version}&wait=1");
        Assert.Equal(HttpStatusCode.NotModified, timeout.StatusCode);

        var stopwatch = Stopwatch.StartNew();
        var poll = DeviceSend(board, t, HttpMethod.Get, $"devices/{board.Id}/scoreboard?since={version}&wait=20");
        await Task.Delay(300);
        await PostGoal(goalA, t, 1);
        var woken = await poll;
        Assert.Equal(HttpStatusCode.OK, woken.StatusCode);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(5));
        Assert.Equal(1, (await ReadDeviceJson<ScoreboardStateResponse>(woken)).Match!.Right.Score);
    }

    [Fact]
    public async Task SleepStatusAndTimeout_CloseAbandonedMatches()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);

        await PostGoal(goalA, t, 1);
        await AgeLiveMatchesAsync(TimeSpan.FromMinutes(5));
        var status = await DeviceSend(goalA, t, HttpMethod.Post, $"devices/{goalA.Id}/status", new
        {
            device_id = goalA.Id, role = "goal", reason = "sleep", battery_mv = 3400, firmware_version = "0.1.0",
            uptime_ms = 1000, queued_events = 0, dropped_events = 0, beam_blocked = false, low_batt = true,
            metrics = new { reset_reason = "deepsleep" },
        });
        Assert.Equal(HttpStatusCode.NoContent, status.StatusCode);
        Assert.Equal("finished", (await GetBoard(board, t)).Match!.Status);

        var devices = await ReadJsonAsync<List<DeviceResponse>>(await Client.GetAsync($"{t.Admin}/devices"));
        var reported = devices!.Single(d => d.DeviceId == goalA.Id);
        Assert.True(reported.LowBatt);
        Assert.Equal(3400, reported.BatteryMv);

        // Server-side timeout for a missed sleep status.
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        await PostGoal(goalA, t, 2);
        await AgeLiveMatchesAsync(TimeSpan.FromHours(1));
        using (var scope = Factory.Services.CreateScope())
        {
            Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<ITableMatchService>().CloseStaleMatchesAsync());
        }

        Assert.Equal("finished", (await GetBoard(board, t)).Match!.Status);
    }

    [Fact]
    public async Task ShortLinks_ResolveForMembers_AndClaimUrlUsesThem()
    {
        await using var factory = Factory.WithWebHostBuilder(b =>
            b.UseSetting("Hardware:PublicFrontendBaseUrl", "https://app.example.test/"));
        using var client = factory.CreateClient();
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        await PostGoal(goalA, t, 1);
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });

        var state = await ReadDeviceJson<ScoreboardStateResponse>(
            await client.SendAsync(DeviceRequest(board, t, HttpMethod.Get, $"devices/{board.Id}/scoreboard")));
        Assert.True(state.NeedsClaim);
        Assert.StartsWith("https://app.example.test/t/", state.ClaimUrl);
        Assert.True(state.ClaimUrl!.Length <= 60);
        Assert.NotEqual(state.TableUrl, state.ClaimUrl);

        var matchCode = state.ClaimUrl[^10..];
        var resolved = await ReadJsonAsync<ShortLinkResponse>(
            await client.GetAsync($"api/v3/short-links/{matchCode.ToLowerInvariant()}"));
        Assert.Equal($"/{t.Org.Slug}/{t.League.Slug}/submit?table={t.TableId}&match={state.Match!.Id}", resolved!.Path);

        // The permanent table code opens the latest claimable match, or the table once there is none.
        var tableCode = state.TableUrl![^10..];
        resolved = await ReadJsonAsync<ShortLinkResponse>(await client.GetAsync($"api/v3/short-links/{tableCode}"));
        Assert.Equal(state.Match.Id, resolved!.TableMatchId.ToString());
        await PostAction(board, t, new { type = "new_game", expected_version = state.Version, save = true });
        await PostGoal(goalA, t, 2);
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = false });
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            await db.TableMatches.ExecuteUpdateAsync(s => s.SetProperty(m => m.EndedAt, m => m.EndedAt!.Value.AddDays(-8)));
        }

        resolved = await ReadJsonAsync<ShortLinkResponse>(await client.GetAsync($"api/v3/short-links/{tableCode}"));
        Assert.Null(resolved!.TableMatchId);
        resolved = await ReadJsonAsync<ShortLinkResponse>(await client.GetAsync($"api/v3/short-links/{matchCode}"));
        Assert.Null(resolved!.TableMatchId);

        // Regenerating revokes the old table code.
        var regenerated = await ReadJsonAsync<TableResponse>(
            await client.PostAsync($"{t.Admin}/tables/{t.TableId}/short-code", null));
        Assert.NotEqual(tableCode, regenerated!.ShortCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"api/v3/short-links/{tableCode}")).StatusCode);

        var outsiderOrg = await CreateOrganization("Other", "other-org");
        await SeedOrgMember(outsiderOrg.Id, "outsider", "outsider@test.com");
        AuthenticateAs("outsider");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"api/v3/short-links/{tableCode}")).StatusCode);
    }

    // ---- Cards ----

    [Fact]
    public void CardUidHasher_IsKeyedPerOrg_AndIgnoresCase()
    {
        var hasher = Factory.Services.GetRequiredService<CardUidHasher>();
        var org = Guid.NewGuid();

        Assert.Equal(hasher.Hash(org, "04A1B2C3D4E5F6"), hasher.Hash(org, "04a1b2c3d4e5f6"));
        Assert.NotEqual(hasher.Hash(org, "04a1b2c3d4e5f6"), hasher.Hash(Guid.NewGuid(), "04a1b2c3d4e5f6"));
        Assert.Equal(32, hasher.Hash(org, "a1b2c3d4")!.Length);
        Assert.Null(hasher.Hash(org, "a1b2c3"));
        Assert.Null(hasher.Hash(org, "zzb2c3d4"));

        Assert.False(new CardUidHasher(Config(null)).IsConfigured);
        Assert.Throws<InvalidOperationException>(() => new CardUidHasher(Config("c2hvcnQ=")));
        Assert.Throws<InvalidOperationException>(() => new CardUidHasher(Config("not base64!")));

        static IConfiguration Config(string? key) => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [CardUidHasher.ConfigKey] = key }).Build();
    }

    [Fact]
    public async Task CardLink_LinksTheScannedCardToTheCaller_AndCanBeUnlinked()
    {
        var t = await SetupTableAsync();
        var (_, p1, _) = await SeedTestUser(t.Org.Id, t.League.Id, "p1", "p1@test.com", displayName: "Pia");
        await SeedTestUser(t.Org.Id, t.League.Id, "p2", "p2@test.com");
        var code = await SeedCardLinkAsync(t, "04a1b2c3d4e5f6");

        AuthenticateAs("p1");
        var link = await ReadJsonAsync<ShortLinkResponse>(await Client.GetAsync($"api/v3/short-links/{code}"));
        Assert.Equal(ShortLinkKind.Card, link!.Kind);
        Assert.Equal($"/office/cards?code={code}", link.Path);
        Assert.Equal("Table 1", link.TableName);
        Assert.NotNull(link.CardLinkExpiresAt);

        var linked = await Client.PostAsJsonAsync(MyCards(t), new LinkCardRequest { Code = code.ToLowerInvariant() });
        Assert.Equal(HttpStatusCode.Created, linked.StatusCode);
        var card = (await ReadJsonAsync<PlayerCardResponse>(linked))!;
        Assert.Equal(card.Id, Assert.Single((await ReadJsonAsync<List<PlayerCardResponse>>(
            await Client.GetAsync(MyCards(t))))!).Id);
        // The link is used up.
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync($"api/v3/short-links/{code}")).StatusCode);

        // The same card scanned again can't be taken by someone else.
        var again = await SeedCardLinkAsync(t, "04A1B2C3D4E5F6");
        AuthenticateAs("p2");
        Assert.Equal(HttpStatusCode.Conflict,
            (await Client.PostAsJsonAsync(MyCards(t), new LinkCardRequest { Code = again })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.DeleteAsync($"{MyCards(t)}/{card.Id}")).StatusCode);

        AuthenticateAs("owner");
        var listed = Assert.Single((await ReadJsonAsync<List<AdminPlayerCardResponse>>(
            await Client.GetAsync($"{t.Admin}/cards?membershipId={p1.Id}")))!);
        Assert.Equal(("Pia", card.Id), (listed.DisplayName, listed.Id));

        AuthenticateAs("p1");
        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync($"{MyCards(t)}/{card.Id}")).StatusCode);
        Assert.Empty((await ReadJsonAsync<List<PlayerCardResponse>>(await Client.GetAsync(MyCards(t))))!);
    }

    [Fact]
    public async Task CardLink_ForAnotherMember_BelongsToThemAndShowsWhoLinkedIt()
    {
        var t = await SetupTableAsync();
        var (_, p1, _) = await SeedTestUser(t.Org.Id, t.League.Id, "p1", "p1@test.com", displayName: "Pia");
        var (_, p2, _) = await SeedTestUser(t.Org.Id, t.League.Id, "p2", "p2@test.com", displayName: "Paul");
        var (_, gone, _) = await SeedTestUser(t.Org.Id, t.League.Id, "gone", "gone@test.com");
        var otherOrg = await CreateOrganization("Other", "other-org");
        var (_, outsider) = await SeedOrgMember(otherOrg.Id, "outsider", "outsider@test.com");
        AuthenticateAs("owner");
        await Client.DeleteAsync($"api/v3/organizations/{t.Org.Id}/members/{gone.Id}");
        Task<HttpResponseMessage> Link(string code, Guid? membershipId = null, Guid? orgId = null) =>
            Client.PostAsJsonAsync($"api/v3/organizations/{orgId ?? t.Org.Id}/me/cards",
                new LinkCardRequest { Code = code, MembershipId = membershipId });

        // To yourself: no "linked by".
        AuthenticateAs("p1");
        var own = (await ReadJsonAsync<PlayerCardResponse>(await Link(await SeedCardLinkAsync(t, "a1b2c3d4"))))!;
        Assert.Equal((ScanResultType.Joined, null), (own.RosterResult, own.LinkedBy));

        // For someone else: theirs, they join the table, and it says who linked it.
        var forPaul = await Link(await SeedCardLinkAsync(t, "a1b2c3d5"), p2.Id);
        Assert.Equal(HttpStatusCode.Created, forPaul.StatusCode);
        var paulsCard = (await ReadJsonAsync<PlayerCardResponse>(forPaul))!;
        Assert.Equal((ScanResultType.Joined, p1.Id, "Pia"),
            (paulsCard.RosterResult, paulsCard.LinkedBy!.MembershipId, paulsCard.LinkedBy.DisplayName));
        Assert.Equal([own.Id], (await ReadJsonAsync<List<PlayerCardResponse>>(await Client.GetAsync(MyCards(t))))!.Select(c => c.Id));

        // Only active members of this organization; an outsider can't use this organization's code.
        var code = await SeedCardLinkAsync(t, "a1b2c3d6");
        Assert.Equal(HttpStatusCode.NotFound, (await Link(code, Guid.NewGuid())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Link(code, gone.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Link(code, outsider.Id)).StatusCode);
        AuthenticateAs("outsider");
        Assert.Equal(HttpStatusCode.NotFound, (await Link(code, orgId: otherOrg.Id)).StatusCode);

        AuthenticateAs("owner");
        var admin = (await ReadJsonAsync<List<AdminPlayerCardResponse>>(await Client.GetAsync($"{t.Admin}/cards")))!;
        Assert.Equal([(p1.Id, (Guid?)null), (p2.Id, p1.Id)], admin.Select(c => (c.MembershipId, c.LinkedBy?.MembershipId)));

        AuthenticateAs("p2");
        var mine = Assert.Single((await ReadJsonAsync<List<PlayerCardResponse>>(await Client.GetAsync(MyCards(t))))!);
        Assert.Equal((paulsCard.Id, p1.Id), (mine.Id, mine.LinkedBy!.MembershipId));
        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync($"{MyCards(t)}/{mine.Id}")).StatusCode);
    }

    [Fact]
    public async Task CardLink_ExpiresAndIsSwept()
    {
        var t = await SetupTableAsync();
        await SeedTestUser(t.Org.Id, t.League.Id, "p1", "p1@test.com");
        var expired = await SeedCardLinkAsync(t, "a1b2c3d4", TimeSpan.FromMinutes(-1));

        AuthenticateAs("p1");
        Assert.Equal(HttpStatusCode.Gone, (await Client.GetAsync($"api/v3/short-links/{expired}")).StatusCode);
        Assert.Equal(HttpStatusCode.Gone,
            (await Client.PostAsJsonAsync(MyCards(t), new LinkCardRequest { Code = expired })).StatusCode);

        await SeedCardLinkAsync(t, "a1b2c3d5", TimeSpan.FromMinutes(-1));
        using var scope = Factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ITableMatchService>().CloseStaleMatchesAsync();
        Assert.False(await scope.ServiceProvider.GetRequiredService<ApiDbContext>().CardLinkRequests.AnyAsync());
    }

    [Fact]
    public async Task Cards_AreDeletedWithTheMember_AndByTheOwner()
    {
        var t = await SetupTableAsync();
        var (_, p1, _) = await SeedTestUser(t.Org.Id, t.League.Id, "p1", "p1@test.com");
        await SeedTestUser(t.Org.Id, t.League.Id, "p2", "p2@test.com");
        await SeedTestUser(t.Org.Id, t.League.Id, "mod", "mod@test.com", OrganizationRole.Moderator);
        foreach (var (player, uid) in new[] { ("p1", "a1b2c3d4"), ("p2", "a1b2c3d5"), ("p2", "a1b2c3d6") })
        {
            var code = await SeedCardLinkAsync(t, uid);
            AuthenticateAs(player);
            Assert.Equal(HttpStatusCode.Created,
                (await Client.PostAsJsonAsync(MyCards(t), new LinkCardRequest { Code = code })).StatusCode);
        }

        AuthenticateAs("owner");
        Assert.Equal(HttpStatusCode.NoContent,
            (await Client.DeleteAsync($"api/v3/organizations/{t.Org.Id}/members/{p1.Id}")).StatusCode);
        var left = (await ReadJsonAsync<List<AdminPlayerCardResponse>>(await Client.GetAsync($"{t.Admin}/cards")))!;
        Assert.Equal(2, left.Count);
        Assert.DoesNotContain(left, c => c.MembershipId == p1.Id);

        AuthenticateAs("mod");
        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync($"{t.Admin}/cards/{left[0].Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.DeleteAsync($"{t.Admin}/cards")).StatusCode);

        AuthenticateAs("owner");
        var all = await ReadJsonAsync<DeletedCountResponse>(await Client.DeleteAsync($"{t.Admin}/cards"));
        Assert.Equal(1, all!.Deleted);
    }

    // ---- Occupancy and stats ----

    private async Task<TableOccupancyResponse> OccupancyAsync(TestTable t)
    {
        AuthenticateAs("owner");
        var tables = await ReadJsonAsync<List<TableResponse>>(await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables"));
        return tables!.Single(x => x.Id == t.TableId).Occupancy;
    }

    private async Task<HttpResponseMessage> PostStatusAsync(TestDevice device, TestTable t, string role, string reason, long uptimeMs) =>
        await DeviceSend(device, t, HttpMethod.Post, $"devices/{device.Id}/status", new
        {
            device_id = device.Id, role, reason, battery_mv = 3900, firmware_version = "0.1.0", uptime_ms = uptimeMs,
            queued_events = 0, dropped_events = 0, beam_blocked = false, low_batt = false,
            metrics = new { reset_reason = "deepsleep" },
        });

    [Fact]
    public async Task Occupancy_FollowsTheGame_AndASleepStatusRecordsTheWake()
    {
        var t = await SetupTableAsync();
        Assert.Equal((OccupancyStatus.Unknown, OccupancyReason.NoDevices), ((await OccupancyAsync(t)).Status, (await OccupancyAsync(t)).Reason));
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        // Just woken (their first requests): free, someone's nearby; never used before.
        var touched = await OccupancyAsync(t);
        Assert.Equal((OccupancyStatus.Free, OccupancyReason.Touched, null), (touched.Status, touched.Reason, touched.Since));

        await PostGoal(goalA, t, 1);
        var playing = await OccupancyAsync(t);
        Assert.Equal((OccupancyStatus.InUse, OccupancyReason.Game, 1), (playing.Status, playing.Reason, playing.ScoreA + playing.ScoreB));
        Assert.Equal(OccupancyStatus.InUse, (await ReadJsonAsync<LiveTableResponse>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/live")))!.Table.Occupancy.Status);

        for (var seq = 2; seq <= 10; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        var finished = await OccupancyAsync(t);
        Assert.Equal((OccupancyStatus.JustFinished, 10), (finished.Status, finished.ScoreA + finished.ScoreB));

        // The goal counter sleeps after a 10-min wake: a wake row [now − 10 min, now − 5 min], awake no more.
        Assert.Equal(HttpStatusCode.NoContent, (await PostStatusAsync(goalA, t, "goal", "sleep", 600_000)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await PostStatusAsync(board, t, "scoreboard", "heartbeat", 900)).StatusCode);
        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            var wake = Assert.Single(await dbContext.DeviceWakes.Where(w => w.TableId == t.TableId).ToListAsync());
            Assert.InRange(wake.IdleFrom - wake.WokeAt, TimeSpan.FromSeconds(299), TimeSpan.FromSeconds(301));
            Assert.InRange(DateTimeOffset.UtcNow - wake.WokeAt, TimeSpan.FromMinutes(9.9), TimeSpan.FromMinutes(10.1));
            Assert.All(await dbContext.Devices.Where(d => d.TableId == t.TableId).ToListAsync(), d => Assert.Null(d.AwakeSince));
        }

        // Every device asleep: the finished game no longer shows; free since its last goal.
        var free = await OccupancyAsync(t);
        Assert.Equal((OccupancyStatus.Free, null), (free.Status, free.Reason));
        Assert.NotNull(free.Since);
    }

    [Fact]
    public async Task TableStats_CountGamesAndBusyTime_InTheViewersZone()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        for (var seq = 1; seq <= 10; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        // A fragment: two goals, then "New game" (saved, never claimed).
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        await PostGoal(goalA, t, 11);
        await PostGoal(goalA, t, 12);
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        await PostStatusAsync(goalA, t, "goal", "sleep", 600_000);

        AuthenticateAs("owner");
        var path = $"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/stats";
        var stats = (await ReadJsonAsync<TableStatsResponse>(await Client.GetAsync($"{path}?tz=Europe/Copenhagen")))!;
        Assert.Equal(("Europe/Copenhagen", 1.0, true), (stats.TimeZone, stats.Games.Value, stats.Games.Enough));
        Assert.InRange(stats.GamesPerDay.Count, 30, 31);
        Assert.Equal((1, 0, 1), (stats.GamesPerDay[^1].Games, stats.GamesPerDay[^1].Submitted, stats.GamesPerDay[^1].Unclaimed));
        Assert.Equal(0, stats.GamesPerDay[..^1].Sum(d => d.Games));
        Assert.Equal(1, stats.Weeks.Sum(w => w.Games));
        Assert.False(stats.UtilisationIsLowerBound);
        Assert.Equal(("busy_minutes", 7, 24, false), (stats.BusyHours.Unit, stats.BusyHours.Values.Count, stats.BusyHours.Values[0].Count,
            stats.BusyHours.Enough));
        Assert.True(stats.BusyHours.Values.SelectMany(h => h).Sum() > 0);
        Assert.Equal((1, false), (stats.MatchDurationS.N, stats.MatchDurationS.Enough));
        Assert.NotNull(stats.MatchDurationS.Value);
        // All ten counted goals came from one counter, so they're credited to one end: share 0 or 1, inside its interval.
        Assert.Contains(stats.EndBias.Value, new double?[] { 0, 1 });
        Assert.InRange(stats.EndBias.Value!.Value, stats.EndBias.Low!.Value - 1e-9, stats.EndBias.High!.Value + 1e-9);
        Assert.Equal(1, stats.EndBias.N);
        Assert.Equal(0, stats.ClaimRate.N); // its claim window is still open
        var device = Assert.Single(stats.DataQuality.Devices, d => d.Role == DeviceRole.Goal);
        Assert.Equal((12, false), (device.Goals, device.Out));
        Assert.True(stats.DataQuality.FragmentsPerWeek > 0);
        Assert.Equal(["mon", "tue", "wed", "thu", "fri"], stats.OfficeHours.Days);

        Assert.Equal(HttpStatusCode.BadRequest, (await Client.GetAsync($"{path}?tz=Mars/Olympus")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.GetAsync(
            $"{path}?from=2026-10-10T00:00:00Z&to=2026-10-01T00:00:00Z")).StatusCode);
        var lastWeek = (await ReadJsonAsync<TableStatsResponse>(await Client.GetAsync(
            $"{path}?from={Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(-14).ToString("O"))}&to={Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(-7).ToString("O"))}")))!;
        Assert.Equal((0.0, 0.0), (lastWeek.Games.Value, lastWeek.Utilisation.Value ?? 0));

        var overview = (await ReadJsonAsync<TablesStatsOverviewResponse>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables/stats")))!;
        var row = Assert.Single(overview.Tables);
        Assert.Equal((t.TableId, 1.0, 1), (row.TableId, row.Games.Value, row.GamesThisWeek));
        Assert.Equal(("UTC", "busy_tables", false), (overview.TimeZone, overview.BusyTables.Unit, overview.AllTablesBusy.Share.Enough));
        Assert.Null(overview.AllTablesBusy.Share.Value); // one table

        await SeedOrgMember((await CreateOrganization("Other", "other-org")).Id, "outsider", "outsider@test.com");
        AuthenticateAs("outsider");
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task TableStats_JudgeAGameByItsOwnLeaguesWinningScore()
    {
        var t = await SetupTableAsync();
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        await ClaimAsync(t, DeviceRole.Scoreboard, TableEnd.A);
        for (var seq = 1; seq <= 10; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        // Rated 0:10 in the league to 10, while the table's league now plays to 20.
        var players = await SeedPlayersAsync(t, "a1", "a2", "b1", "b2");
        var tableMatch = Assert.Single((await ReadJsonAsync<List<TableMatchResponse>>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/table-matches?tableId={t.TableId}")))!);
        Assert.Equal(HttpStatusCode.OK, (await Client.PostAsJsonAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/table-matches/{tableMatch.Id}/claim",
            new ClaimTableMatchRequest
            {
                Teams =
                [
                    new ClaimTableMatchTeamRequest { End = TableEnd.B, Players = [players[2], players[3]] },
                    new ClaimTableMatchTeamRequest { End = TableEnd.A, Players = [players[0], players[1]] },
                ],
            })).StatusCode);
        var longer = await CreateLeague(t.Org.Id, "Long", "long", teamSize: 2, winningScore: 20);
        using (var scope = Factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<ApiDbContext>().FoosballTables.Where(x => x.Id == t.TableId)
                .ExecuteUpdateAsync(u => u.SetProperty(x => x.LeagueId, longer.Id));
        }

        AuthenticateAs("owner");
        var stats = (await ReadJsonAsync<TableStatsResponse>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/tables/{t.TableId}/stats")))!;
        Assert.Equal((1.0, 1.0, 1), (stats.Games.Value, stats.ClaimRate.Value ?? 1, stats.MatchDurationS.N));
    }

    // ---- Scan-in roster ----

    [Fact]
    public async Task ScanIn_FillsTheLobby_MakesBalancedTeams_AndLocksOnTheFirstGoal()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        var lobby = await GetBoard(board, t);
        Assert.Equal(("Foosball", 2, 0, false), (lobby.Roster!.LeagueName, lobby.Roster.TeamSize,
            lobby.Roster.Players.Count, lobby.Roster.CanGenerate));

        var joined = await ScanAsync(board, t, cards[0]);
        Assert.Equal(ScanResultType.Joined, joined.Scan!.Result);
        Assert.Equal("P1", joined.Scan.Player!.Name);
        var again = await ScanAsync(board, t, cards[0].ToLowerInvariant());
        Assert.Equal(ScanResultType.AlreadyIn, again.Scan!.Result);
        Assert.Equal(joined.Version, again.Version);

        foreach (var card in cards[1..4])
        {
            Assert.Equal(ScanResultType.Joined, (await ScanAsync(board, t, card)).Scan!.Result);
        }

        Assert.Equal(ScanResultType.RosterFull, (await ScanAsync(board, t, cards[4])).Scan!.Result);
        var unknown = await ScanAsync(board, t, "0000000a");
        Assert.Equal(ScanResultType.UnknownCard, unknown.Scan!.Result);
        var full = unknown.Roster!;
        Assert.True(full.CanGenerate);
        Assert.Equal(["P1", "P2", "P3", "P4"], full.Players.Select(p => p.Name));
        Assert.Equal(4, full.Players.Select(p => p.Color).Distinct().Count());
        Assert.All(full.Players, p => Assert.InRange(p.Color!.Value, 0, 5));
        await using (var withBase = Factory.WithWebHostBuilder(b =>
                         b.UseSetting("Hardware:PublicFrontendBaseUrl", "https://app.example.test/")))
        {
            var link = (await ReadDeviceJson<ScoreboardStateResponse>(await withBase.CreateClient().SendAsync(
                DeviceRequest(board, t, HttpMethod.Get, $"devices/{board.Id}/scoreboard")))).Roster!.Link!;
            Assert.StartsWith("https://app.example.test/t/", link.Url);
            Assert.InRange(link.ExpiresInS, 590, 600);
        }

        var stale = await PostAction(board, t, new { type = "generate_teams", expected_version = unknown.Version - 1 });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var teams = await ReadDeviceJson<ScoreboardStateResponse>(
            await PostAction(board, t, new { type = "generate_teams", expected_version = unknown.Version }));
        // Snake draft by MMR (P4 highest): P4 + P1 against P3 + P2; team 0 at end A, the board's left.
        Assert.Equal(["P4", "P1"], teams.Match!.Left.Players.Select(p => p.Name));
        Assert.Equal(["P3", "P2"], teams.Match.Right.Players.Select(p => p.Name));
        Assert.Equal(full.Players.Single(p => p.Name == "P4").Color, teams.Match.Left.Players[0].Color);
        Assert.Equal((false, null), (teams.Roster!.CanGenerate, teams.Roster.Link));
        Assert.True(teams.Match.CanSwap);
        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await PostAction(board, t, new { type = "generate_teams", expected_version = teams.Version })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await PostAction(board, t,
            new { type = "generate_teams", expected_version = teams.Version, mode = "random" })).StatusCode);

        await PostGoal(goalA, t, 1);
        var live = await GetBoard(board, t);
        Assert.Null(live.Roster);
        Assert.Equal(ScanResultType.Locked, (await ScanAsync(board, t, cards[0])).Scan!.Result);

        // A player in a game on another table is busy.
        var other = await ReadJsonAsync<TableResponse>(await Client.PostAsJsonAsync($"{t.Admin}/tables",
            new UpsertTableRequest { Name = "Table 2", LeagueId = t.League.Id }));
        var t2 = t with { TableId = other!.Id };
        var board2 = await ClaimAsync(t2, DeviceRole.Scoreboard, TableEnd.A);
        Assert.Equal(ScanResultType.Busy, (await ScanAsync(board2, t2, cards[0])).Scan!.Result);
        Assert.Equal(ScanResultType.Joined, (await ScanAsync(board2, t2, cards[4])).Scan!.Result);
    }

    [Fact]
    public async Task ScanIn_GenerateTeams_ManualIsLeftFirst_RandomRedrawsADifferentPairing()
    {
        // The board at end B: its left is end B.
        var (t, board, goalA, cards) = await SetupLobbyAsync(TableEnd.B);
        var players = await FillLobbyAsync(board, t, cards[..4]);
        var ids = players.ToDictionary(p => p.Name, p => p.Id);
        var version = (await GetBoard(board, t)).Version;
        Task<HttpResponseMessage> Generate(string mode, object? teams = null) =>
            PostAction(board, t, new { type = "generate_teams", expected_version = version, mode, teams });

        // Wrong sizes, a player not on the roster, a player twice, none at all: refused, nothing changes.
        object?[] bad =
        [
            new[] { new[] { ids["P1"] }, new[] { ids["P2"], ids["P3"], ids["P4"] } },
            new[] { new[] { ids["P1"], ids["P2"] }, new[] { ids["P3"], Guid.NewGuid().ToString() } },
            new[] { new[] { ids["P1"], ids["P2"] }, new[] { ids["P3"], ids["P1"] } },
            new[] { new[] { ids["P1"], ids["P2"] } },
            null,
        ];
        foreach (var teams in bad)
        {
            Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Generate("manual", teams)).StatusCode);
        }

        Assert.Equal(version, (await GetBoard(board, t)).Version);
        var manual = await ReadDeviceJson<ScoreboardStateResponse>(await Generate("manual",
            new[] { new[] { ids["P2"], ids["P3"] }, new[] { ids["P4"], ids["P1"].ToUpperInvariant() } }));
        Assert.Equal(TeamsMode.Manual, manual.Match!.TeamsMode);
        Assert.Equal("Door", manual.Match.Left.EndLabel);
        Assert.Equal(["P2", "P3"], manual.Match.Left.Players.Select(p => p.Name));
        Assert.Equal(["P4", "P1"], manual.Match.Right.Players.Select(p => p.Name));
        version = manual.Version;
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Generate("random")).StatusCode);

        // Dissolve (remove + rescan), then a random split; "Again" re-draws a different pairing each time.
        await PostAction(board, t, new { type = "remove_player", expected_version = version, player_id = ids["P1"] });
        await ScanAsync(board, t, cards[0]);
        version = (await GetBoard(board, t)).Version;
        var random = await ReadDeviceJson<ScoreboardStateResponse>(await Generate("random"));
        // The pairing, as P1's team.
        static HashSet<string> Pair(ScoreboardStateResponse s) =>
            new[] { s.Match!.Left, s.Match.Right }.Single(team => team.Players.Any(p => p.Name == "P1"))
                .Players.Select(p => p.Name).ToHashSet();
        Assert.Equal(TeamsMode.Random, random.Match!.TeamsMode);
        Assert.Equal(ids.Values.Order(), random.Match.Left.Players.Concat(random.Match.Right.Players).Select(p => p.Id).Order());
        var leftHasP1 = new HashSet<bool>();
        for (var i = 0; i < 12; i++)
        {
            version = random.Version;
            var again = await ReadDeviceJson<ScoreboardStateResponse>(await Generate("random"));
            Assert.False(Pair(again).SetEquals(Pair(random)));
            Assert.Equal((2, 2), (again.Match!.Left.Players.Count, again.Match.Right.Players.Count));
            leftHasP1.Add(again.Match.Left.Players.Any(p => p.Name == "P1"));
            random = again;
        }

        Assert.Equal(2, leftHasP1.Count); // the ends are random too (fails with chance 2^-11)
        Assert.Single(await ListActiveMatchesAsync(t));
        version = random.Version;
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Generate("fair")).StatusCode);
        await PostGoal(goalA, t, 1);
        version = (await GetBoard(board, t)).Version;
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Generate("random")).StatusCode);
    }

    [Fact]
    public async Task ScanIn_RemoveDissolvesTeams_DiscardKeepsThem_AndRematchReplaysThem()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        var players = await FillLobbyAsync(board, t, cards[..4]);
        var teams = await GenerateAsync(board, t);
        var p2 = teams.Match!.Right.Players.Single(p => p.Name == "P2").Id;

        var dissolved = await ReadDeviceJson<ScoreboardStateResponse>(
            await PostAction(board, t, new { type = "remove_player", expected_version = teams.Version, player_id = p2 }));
        Assert.Null(dissolved.Match);
        Assert.Equal(["P1", "P3", "P4"], dissolved.Roster!.Players.Select(p => p.Name));
        Assert.Empty(await ListActiveMatchesAsync(t));

        Assert.Equal(ScanResultType.Joined, (await ScanAsync(board, t, cards[1])).Scan!.Result);
        teams = await GenerateAsync(board, t);
        await PostGoal(goalA, t, 1);
        var discarded = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t,
            new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = false }));
        Assert.Equal((0, 0), (discarded.Match!.Left.Score, discarded.Match.Right.Score));
        Assert.Equal(["P4", "P1"], discarded.Match.Left.Players.Select(p => p.Name));
        Assert.Equal((TeamsMode.Fair, TeamsMode.Fair), (teams.Match!.TeamsMode, discarded.Match.TeamsMode));
        Assert.NotNull(discarded.Roster);

        for (var seq = 2; seq < 12; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        var finished = await GetBoard(board, t);
        // Finished: the roster is there but empty (a card would start a new lobby).
        Assert.Equal(("finished", 0, false), (finished.Match!.Status, finished.Roster!.Players.Count, finished.Roster.CanGenerate));
        var rematch = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t,
            new { type = "new_game", expected_version = finished.Version, save = true }));
        Assert.Equal(("live", 0, 0), (rematch.Match!.Status, rematch.Match.Left.Score, rematch.Match.Right.Score));
        Assert.Equal(["P4", "P1"], rematch.Match.Left.Players.Select(p => p.Name));
        Assert.Equal(["P3", "P2"], rematch.Match.Right.Players.Select(p => p.Name));
        Assert.Equal(TeamsMode.Fair, rematch.Match.TeamsMode);
        Assert.Equal(players.OrderBy(p => p.Name).Select(p => p.Color),
            rematch.Roster!.Players.OrderBy(p => p.Name).Select(p => p.Color));

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(1, await dbContext.TableMatches.CountAsync(m => m.Status == TableMatchStatus.Submitted));
        Assert.Single(await ListActiveMatchesAsync(t));
    }

    [Fact]
    public async Task ScanIn_OnAFinishedGame_ConfirmsItAndStartsANewLobby()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        await FillLobbyAsync(board, t, cards[..4]);
        await GenerateAsync(board, t);
        for (var seq = 1; seq <= 10; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        Assert.Equal("finished", (await GetBoard(board, t)).Match!.Status);
        var lobby = await ScanAsync(board, t, cards[4]);
        Assert.Equal(ScanResultType.Joined, lobby.Scan!.Result);
        Assert.Null(lobby.Match);
        Assert.Equal(["P5"], lobby.Roster!.Players.Select(p => p.Name));
        Assert.False(lobby.NeedsClaim);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(1, await dbContext.TableMatches.CountAsync(m => m.Status == TableMatchStatus.Submitted));
        Assert.Empty(await ListActiveMatchesAsync(t));
    }

    [Fact]
    public async Task ScanIn_IsOff_InALeagueTooBigForTheBoard_AndALinkedCardJoinsAtOnce()
    {
        var (t, board, _, cards) = await SetupLobbyAsync();
        var code = await SeedCardLinkAsync(t, "0000000b");
        AuthenticateAs("p1");
        var linked = await ReadJsonAsync<PlayerCardResponse>(
            await Client.PostAsJsonAsync(MyCards(t), new LinkCardRequest { Code = code }));
        Assert.Equal(ScanResultType.Joined, linked!.RosterResult);
        Assert.Equal(ScanResultType.AlreadyIn, (await ScanAsync(board, t, "0000000B")).Scan!.Result);
        Assert.Equal(["P1"], (await GetBoard(board, t)).Roster!.Players.Select(p => p.Name));

        var threes = await CreateLeague(t.Org.Id, "Threes", "threes", teamSize: 3);
        AuthenticateAs("owner");
        await Client.PutAsJsonAsync($"{t.Admin}/tables/{t.TableId}", new UpsertTableRequest { Name = "Table 1", LeagueId = threes.Id });
        var off = await ScanAsync(board, t, cards[0]);
        Assert.Equal((ScanResultType.NoLeague, null), (off.Scan!.Result, off.Roster));
    }

    [Fact]
    public async Task ScanIn_AnIdleLobbyIsCleared()
    {
        var (t, board, _, cards) = await SetupLobbyAsync();
        await FillLobbyAsync(board, t, cards[..2]);
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var tableMatches = scope.ServiceProvider.GetRequiredService<ITableMatchService>();

        await tableMatches.CloseStaleMatchesAsync();
        Assert.Equal(2, (await GetBoard(board, t)).Roster!.Players.Count);

        await dbContext.TableRosterEntries.ExecuteUpdateAsync(s =>
            s.SetProperty(e => e.CreatedAt, e => e.CreatedAt - TimeSpan.FromMinutes(31)));
        var before = (await GetBoard(board, t)).Version;
        await tableMatches.CloseStaleMatchesAsync();
        var after = await GetBoard(board, t);
        Assert.Empty(after.Roster!.Players);
        Assert.True(after.Version > before);
    }

    // ---- Goals: scorers fixed in the app, Finished summary ----

    [Fact]
    public async Task Goals_ScorersAreFixedInTheApp_AndTheFinishedBoardShowsTheSummary()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        var goalB = await ClaimAsync(t, DeviceRole.Goal, TableEnd.B);
        await FillLobbyAsync(board, t, cards[..4]);
        var teams = await GenerateAsync(board, t);
        Guid Id(string name) => Guid.Parse(teams.Match!.Left.Players.Concat(teams.Match.Right.Players).Single(p => p.Name == name).Id);
        var (p3, p2) = (Id("P3"), Id("P2")); // team 1 (end B); team 0 (end A) is P4 + P1

        // 2:10 for team 1, goals 4 s apart by the devices' clocks.
        var start = DateTimeOffset.UtcNow - TimeSpan.FromSeconds(50);
        var seq = 0;
        for (var i = 0; i < 12; i++)
        {
            seq++;
            await PostGoal(i < 2 ? goalB : goalA, t, seq, occurredAt: start + TimeSpan.FromSeconds(4 * seq));
        }

        var finished = await GetBoard(board, t);
        Assert.Equal("finished", finished.Match!.Status);
        Assert.Equal((44, null), (finished.Match.Summary!.DurationS, finished.Match.Summary.MvpName));

        var url = $"api/v3/organizations/{t.Org.Id}/table-matches/{finished.Match.Id}/goals";
        AuthenticateAs("p3");
        var goals = (await ReadJsonAsync<MatchGoalsResponse>(await Client.GetAsync(url)))!;
        Assert.True(goals.CanEdit);
        Assert.Equal([0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], goals.Goals.Select(g => g.TeamIndex));
        Assert.Equal((2, 10), (goals.Goals[^1].ScoreA, goals.Goals[^1].ScoreB));
        Task<HttpResponseMessage> Put(string at, Guid goalId, Guid? player) =>
            Client.PutAsJsonAsync($"{at}/{goalId}/scorer", new SetGoalScorerRequest { LeaguePlayerId = player });

        foreach (var (goal, i) in goals.Goals.Skip(2).Take(9).Select((g, i) => (g, i)))
        {
            Assert.Equal(HttpStatusCode.OK, (await Put(url, goal.Id, i < 7 ? p3 : p2)).StatusCode);
        }

        // P2 (team 1) on a team-0 goal: an own goal; the score doesn't change.
        var own = (await ReadJsonAsync<MatchGoalResponse>(await Put(url, goals.Goals[0].Id, p2)))!;
        Assert.Equal((true, 0, 1, 0), (own.OwnGoal, own.TeamIndex, own.ScoreA, own.ScoreB));
        // 10 of 12 known; P3 +7 − ½ = 6.5 beats P2 +2 − 1 − ½.
        Assert.Equal("P3", (await GetBoard(board, t)).Match!.Summary!.MvpName);

        Assert.Equal(HttpStatusCode.BadRequest, (await Put(url, goals.Goals[1].Id, Guid.NewGuid())).StatusCode);
        AuthenticateAs("p5");
        Assert.False((await ReadJsonAsync<MatchGoalsResponse>(await Client.GetAsync(url)))!.CanEdit);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put(url, goals.Goals[1].Id, null)).StatusCode);

        var undo = await PostAction(board, t, new { type = "undo_last_goal", expected_version = (await GetBoard(board, t)).Version });
        Assert.Equal(HttpStatusCode.OK, undo.StatusCode);
        AuthenticateAs("p3");
        Assert.Equal(HttpStatusCode.NotFound, (await Put(url, goals.Goals[^1].Id, p3)).StatusCode);

        // Rated (confirmed on the board), as a table match: the same goals by match id, scorers kept.
        await PostGoal(goalA, t, ++seq);
        var confirmed = await PostAction(board, t,
            new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        AuthenticateAs("owner");
        var match = Assert.Single((await ReadJsonAsync<List<MatchResponse>>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/matches")))!);
        Assert.Equal(MatchSource.Table, match.Source);
        var matchUrl = $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/matches/{match.Id}/goals";
        var rated = (await ReadJsonAsync<MatchGoalsResponse>(await Client.GetAsync(matchUrl)))!;
        Assert.Equal((match.Id, true, 12, 10), (rated.MatchId, rated.CanEdit, rated.Goals.Count,
            rated.Goals.Count(g => g.ScorerLeaguePlayerId is not null)));
        var cleared = (await ReadJsonAsync<MatchGoalResponse>(await Put(matchUrl, rated.Goals[2].Id, null)))!;
        Assert.Null(cleared.ScorerLeaguePlayerId);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/matches/{Guid.NewGuid()}/goals")).StatusCode);
    }

    [Fact]
    public async Task Goals_ATiedMvpOfAClaimedMatch_IsDecidedOnImpactFromPreMatchRatings()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        await FillLobbyAsync(board, t, cards[..4]);
        var teams = await GenerateAsync(board, t);
        var players = teams.Match!.Right.Players; // team 1, credited by the goal counter at end A
        for (var seq = 1; seq <= 10; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        var tableMatchId = (await GetBoard(board, t)).Match!.Id;
        var url = $"api/v3/organizations/{t.Org.Id}/table-matches/{tableMatchId}/goals";
        AuthenticateAs("owner");
        var goals = (await ReadJsonAsync<MatchGoalsResponse>(await Client.GetAsync(url)))!.Goals;
        // 5 each: tied on contribution; the first five moved the 10:0 most.
        foreach (var (goal, i) in goals.Select((g, i) => (g, i)))
        {
            await Client.PutAsJsonAsync($"{url}/{goal.Id}/scorer",
                new SetGoalScorerRequest { LeaguePlayerId = Guid.Parse(players[i < 5 ? 0 : 1].Id) });
        }

        var claimed = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/table-matches/{tableMatchId}/claim",
            new ClaimTableMatchRequest());
        Assert.Equal(HttpStatusCode.OK, claimed.StatusCode);

        var board2 = await GetBoard(board, t);
        Assert.Equal(("finished", false), (board2.Match!.Status, board2.NeedsClaim));
        Assert.Equal(players[0].Name, board2.Match.Summary!.MvpName);
    }

    [Fact]
    public async Task ShortCodes_CanBeReadable_AndTheTableLinkFollowsTheGame()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        // No body: a new random code, as before.
        var randomCode = (await ReadJsonAsync<TableResponse>(
            await Client.PostAsync($"{t.Admin}/tables/{t.TableId}/short-code", null)))!.ShortCode;
        Assert.Matches("^[0-9A-Z]{10}$", randomCode);
        var custom = (await ReadJsonAsync<TableResponse>(await Client.PostAsJsonAsync($"{t.Admin}/tables/{t.TableId}/short-code",
            new SetTableShortCodeRequest { Code = "Table-1" })))!;
        Assert.Equal("table-1", custom.ShortCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync($"api/v3/short-links/{randomCode}")).StatusCode);
        async Task<ShortLinkResponse> Resolve(string code = "TABLE-1") =>
            (await ReadJsonAsync<ShortLinkResponse>(await Client.GetAsync($"api/v3/short-links/{code}")))!;
        var page = $"/office/foosball";

        // Codes are unique across tables, matches and cards, case-insensitively.
        var other = (await ReadJsonAsync<TableResponse>(await Client.PostAsJsonAsync($"{t.Admin}/tables",
            new UpsertTableRequest { Name = "Table 2", LeagueId = t.League.Id })))!;
        Task<HttpResponseMessage> SetOther(string code) =>
            Client.PostAsJsonAsync($"{t.Admin}/tables/{other.Id}/short-code", new SetTableShortCodeRequest { Code = code });
        Assert.Equal(HttpStatusCode.Conflict, (await SetOther("TABLE-1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await SetOther("ab")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await SetOther("a_b")).StatusCode);

        // Idle: the submit page for the table.
        Assert.Equal((t.TableId, $"{page}/submit?table={t.TableId}"), ((await Resolve()).TableId, (await Resolve()).Path));

        // Live: the table page, by table and by match code.
        await PostGoal(goalA, t, 1);
        var live = await GetBoard(board, t);
        Assert.Equal($"{page}/tables/{t.TableId}", (await Resolve()).Path);
        string matchCode;
        using (var scope = Factory.Services.CreateScope())
        {
            matchCode = await scope.ServiceProvider.GetRequiredService<ApiDbContext>().TableMatches
                .Where(m => m.TableId == t.TableId).Select(m => m.ShortCode).SingleAsync();
        }

        Assert.Equal($"{page}/tables/{t.TableId}", (await Resolve(matchCode)).Path);
        Assert.Equal(HttpStatusCode.Conflict, (await SetOther(matchCode.ToLowerInvariant())).StatusCode);

        // Finished, unlinked: the live page for 2 min (the result first), then the submit page, prefilled; still
        // so once the board has moved on to the lobby.
        async Task EndedMinutesAgo(int minutes)
        {
            using var scope = Factory.Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ApiDbContext>().TableMatches
                .Where(m => m.TableId == t.TableId && m.EndedAt != null)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.EndedAt, m => m.EndedAt!.Value.AddMinutes(-minutes)));
        }

        var saved = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t,
            new { type = "new_game", expected_version = live.Version, save = true }));
        Assert.Equal($"{page}/tables/{t.TableId}", (await Resolve()).Path);
        await EndedMinutesAgo(3);
        var claimable = await Resolve();
        Assert.Equal($"{page}/submit?table={t.TableId}&match={saved.Match!.Id}", claimable.Path);
        await PostAction(board, t, new { type = "new_game", expected_version = saved.Version, save = true });
        Assert.Equal(claimable.Path, (await Resolve()).Path);

        // Linked: the table page while it is played and while it waits for the auto-submit; then the match page.
        await FillLobbyAsync(board, t, cards[..4]);
        await GenerateAsync(board, t);
        Assert.Equal($"{page}/tables/{t.TableId}", (await Resolve()).Path);
        for (var seq = 2; seq <= 11; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        Assert.Equal($"{page}/tables/{t.TableId}", (await Resolve()).Path);
        await DueNowAsync();
        await SubmitDueAsync();
        Assert.Equal($"{page}/tables/{t.TableId}", (await Resolve()).Path);
        await EndedMinutesAgo(3);
        var rated = await Resolve();
        Assert.NotNull(rated.MatchId);
        Assert.Equal(($"{page}/match/{rated.MatchId}", null), (rated.Path, rated.TableMatchId));
    }

    // ---- Auto-submit ----

    [Fact]
    public async Task AutoSubmit_RatesAWonLinkedMatchOnce_AfterTheDelay_AndRematchStillWorks()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        await FillLobbyAsync(board, t, cards[..4]);
        var teams = await GenerateAsync(board, t);
        for (var seq = 1; seq <= 10; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        var pending = await GetBoard(board, t);
        Assert.Equal(("finished", true), (pending.Match!.Status, pending.NeedsClaim));
        Assert.InRange(pending.Match.SubmitInS!.Value, 9, 10);
        Assert.Equal(0, await SubmitDueAsync());

        await DueNowAsync();
        // Two replicas at once: one submit.
        var runs = await Task.WhenAll(SubmitDueAsync(), SubmitDueAsync());
        Assert.Equal(1, runs.Sum());
        Assert.Equal(0, await SubmitDueAsync());

        var rated = await GetBoard(board, t);
        Assert.True(rated.Version > pending.Version);
        Assert.Equal(("finished", false, null, null, false), (rated.Match!.Status, rated.NeedsClaim, rated.ClaimUrl,
            rated.Match.SubmitInS, rated.Match.CanUndo));
        Assert.Equal(teams.Match!.Right.Players.Select(p => (p.Name, p.Color)),
            rated.Match.Right.Players.Select(p => (p.Name, p.Color)));
        AuthenticateAs("owner");
        var match = Assert.Single((await ReadJsonAsync<List<MatchResponse>>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/matches")))!);
        Assert.Equal((MatchSource.Table, 10), (match.Source, match.Teams.Max(team => team.Score)));

        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await PostAction(board, t, new { type = "undo_last_goal", expected_version = rated.Version })).StatusCode);
        var scorer = await PostAction(board, t, new
        {
            type = "assign_scorer", expected_version = rated.Version, goal_id = rated.Match.LastGoal!.Id,
            player_id = rated.Match.Right.Players[0].Id,
        });
        Assert.Equal(HttpStatusCode.OK, scorer.StatusCode);

        var rematch = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t,
            new { type = "new_game", expected_version = (await ReadDeviceJson<ScoreboardStateResponse>(scorer)).Version, save = true }));
        Assert.Equal(("live", 0, 0), (rematch.Match!.Status, rematch.Match.Left.Score, rematch.Match.Right.Score));
        Assert.Equal(teams.Match.Left.Players.Select(p => p.Name), rematch.Match.Left.Players.Select(p => p.Name));
        Assert.Equal(teams.Match.Right.Players.Select(p => p.Name), rematch.Match.Right.Players.Select(p => p.Name));
    }

    [Fact]
    public async Task AutoSubmit_UndoCancelsIt_AndUnlinkedMatchesNeverAutoSubmit()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        await FillLobbyAsync(board, t, cards[..4]);
        await GenerateAsync(board, t);
        for (var seq = 1; seq <= 10; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        var undone = await ReadDeviceJson<ScoreboardStateResponse>(await PostAction(board, t,
            new { type = "undo_last_goal", expected_version = (await GetBoard(board, t)).Version }));
        Assert.Equal(("live", null), (undone.Match!.Status, undone.Match.SubmitInS));
        await DueNowAsync();
        Assert.Equal(0, await SubmitDueAsync());

        // Anonymous (unlinked): finished at 10, claimable, never rated by itself.
        var discard = await PostAction(board, t, new { type = "new_game", expected_version = undone.Version, save = false });
        await PostAction(board, t, new { type = "remove_player", expected_version = (await ReadDeviceJson<ScoreboardStateResponse>(discard)).Version,
            player_id = (await GetBoard(board, t)).Roster!.Players[0].Id });
        for (var seq = 11; seq <= 20; seq++)
        {
            await PostGoal(goalA, t, seq);
        }

        var anonymous = await GetBoard(board, t);
        Assert.Equal(("finished", true, null), (anonymous.Match!.Status, anonymous.NeedsClaim, anonymous.Match.SubmitInS));
        await DueNowAsync();
        Assert.Equal(0, await SubmitDueAsync());
    }

    [Fact]
    public async Task AutoSubmit_IsOffAtZero_AndRunsByItselfWhenOn()
    {
        var (t, board, goalA, cards) = await SetupLobbyAsync();
        await FillLobbyAsync(board, t, cards[..4]);
        await GenerateAsync(board, t);
        await using (var off = Factory.WithWebHostBuilder(b => b.UseSetting("Hardware:AutoSubmitDelaySeconds", "0")))
        {
            var client = off.CreateClient();
            for (var seq = 1; seq <= 10; seq++)
            {
                await PostGoal(goalA, t, seq, client: client);
            }
        }

        Assert.Null((await GetBoard(board, t)).Match!.SubmitInS);
        await DueNowAsync();
        Assert.Equal(0, await SubmitDueAsync());

        // Confirm it, rematch, and win again with a 1 s delay and the background service running.
        await PostAction(board, t, new { type = "new_game", expected_version = (await GetBoard(board, t)).Version, save = true });
        await using var on = Factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Hardware:AutoSubmitDelaySeconds", "1");
            b.ConfigureTestServices(services => services.AddHostedService<TableAutoSubmitBackgroundService>());
        });
        var onClient = on.CreateClient();
        for (var seq = 11; seq <= 20; seq++)
        {
            await PostGoal(goalA, t, seq, client: onClient);
        }

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var stopwatch = Stopwatch.StartNew();
        while (await dbContext.TableMatches.CountAsync(m => m.Status == TableMatchStatus.Submitted) < 2 &&
               stopwatch.Elapsed < TimeSpan.FromSeconds(10))
        {
            await Task.Delay(100);
        }

        Assert.Equal(2, await dbContext.TableMatches.CountAsync(m => m.Status == TableMatchStatus.Submitted));
        Assert.InRange(stopwatch.Elapsed, TimeSpan.Zero, TimeSpan.FromSeconds(4));
    }

    /// <summary>ux's "rated" on a finished match: claim_url null and no countdown, given a public frontend URL.</summary>
    [Fact]
    public async Task AutoSubmit_FinishedClaimUrlIsNullOnlyOnceRated()
    {
        await using var withBase = Factory.WithWebHostBuilder(b =>
            b.UseSetting("Hardware:PublicFrontendBaseUrl", "https://app.example.test/"));
        var client = withBase.CreateClient();
        async Task<ScoreboardStateResponse> Board(TestDevice board, TestTable t) =>
            await ReadDeviceJson<ScoreboardStateResponse>(
                await client.SendAsync(DeviceRequest(board, t, HttpMethod.Get, $"devices/{board.Id}/scoreboard")));

        var (t, board, goalA, cards) = await SetupLobbyAsync();
        // Unlinked, finished: claimable, so a claim link.
        for (var seq = 1; seq <= 10; seq++) await PostGoal(goalA, t, seq);
        var unlinked = await Board(board, t);
        Assert.Equal(("finished", true), (unlinked.Match!.Status, unlinked.ClaimUrl is not null));
        Assert.Null(unlinked.Match.SubmitInS);
        // Without a public frontend URL claim_url is always null: there needs_claim alone tells it's unrated.
        var noBase = await GetBoard(board, t);
        Assert.Equal((null, true), (noBase.ClaimUrl, noBase.NeedsClaim));

        // Claimed in the app: rated, no link.
        AuthenticateAs("owner");
        List<Guid> ids;
        using (var scope = Factory.Services.CreateScope())
        {
            ids = await scope.ServiceProvider.GetRequiredService<ApiDbContext>().LeaguePlayers
                .Where(lp => lp.LeagueId == t.League.Id).Select(lp => lp.Id).Take(4).ToListAsync();
        }

        var claim = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/table-matches/{unlinked.Match.Id}/claim",
            new ClaimTableMatchRequest
            {
                Teams =
                [
                    new ClaimTableMatchTeamRequest { End = TableEnd.A, Players = ids[..2].Select(id => new SubmitMatchPlayerRequest { LeaguePlayerId = id }).ToList() },
                    new ClaimTableMatchTeamRequest { End = TableEnd.B, Players = ids[2..].Select(id => new SubmitMatchPlayerRequest { LeaguePlayerId = id }).ToList() },
                ],
            });
        Assert.Equal(HttpStatusCode.OK, claim.StatusCode);
        var claimed = await Board(board, t);
        Assert.Equal(("finished", null, false), (claimed.Match!.Status, claimed.ClaimUrl, claimed.NeedsClaim));

        // Linked (New game on the claimed match is a rematch of its teams): a link during the countdown, none
        // once auto-submitted.
        var rematch = await ReadDeviceJson<ScoreboardStateResponse>(
            await PostAction(board, t, new { type = "new_game", expected_version = claimed.Version, save = true }));
        Assert.Equal(2, rematch.Match!.Left.Players.Count);
        for (var seq = 11; seq <= 20; seq++) await PostGoal(goalA, t, seq);
        var counting = await Board(board, t);
        Assert.Equal((true, true), (counting.ClaimUrl is not null, counting.Match!.SubmitInS is not null));
        await DueNowAsync();
        await SubmitDueAsync();
        var auto = await Board(board, t);
        Assert.Equal(("finished", null, null, false), (auto.Match!.Status, auto.ClaimUrl, auto.Match.SubmitInS, auto.NeedsClaim));
    }

    private async Task<int> SubmitDueAsync()
    {
        using var scope = Factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ITableMatchService>().SubmitDueMatchesAsync();
    }

    private async Task DueNowAsync()
    {
        using var scope = Factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ApiDbContext>().TableMatches.Where(m => m.AutoSubmitAt != null)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.AutoSubmitAt, DateTimeOffset.UtcNow.AddSeconds(-1)));
    }

    // ---- Helpers ----

    /// <summary>A table with a scoreboard and a goal counter at end A, and cards for P1–P5 (MMR rising).</summary>
    private async Task<(TestTable Table, TestDevice Board, TestDevice GoalA, string[] Cards)> SetupLobbyAsync(
        TableEnd boardEnd = TableEnd.A)
    {
        var t = await SetupTableAsync();
        var board = await ClaimAsync(t, DeviceRole.Scoreboard, boardEnd);
        var goalA = await ClaimAsync(t, DeviceRole.Goal, TableEnd.A);
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<CardUidHasher>();
        var cards = new List<string>();
        for (var i = 1; i <= 5; i++)
        {
            var (_, membership, player) = await SeedTestUser(t.Org.Id, t.League.Id, $"p{i}", $"p{i}@test.com",
                displayName: $"P{i}");
            await dbContext.LeaguePlayers.Where(p => p.Id == player.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Mmr, 1000 + 100 * i));
            var uid = $"04A1B2C3D4E5{i:X2}";
            dbContext.PlayerCards.Add(new PlayerCard
            {
                OrganizationId = t.Org.Id,
                OrganizationMembershipId = membership.Id,
                UidHmac = hasher.Hash(t.Org.Id, uid)!,
            });
            cards.Add(uid);
        }

        await dbContext.SaveChangesAsync();
        AuthenticateAs("owner");
        return (t, board, goalA, cards.ToArray());
    }

    private async Task<ScoreboardStateResponse> ScanAsync(TestDevice board, TestTable t, string uid)
    {
        var response = await PostAction(board, t, new { type = "scan", expected_version = 0, uid });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadDeviceJson<ScoreboardStateResponse>(response);
    }

    private async Task<List<ScoreboardPlayer>> FillLobbyAsync(TestDevice board, TestTable t, string[] cards)
    {
        foreach (var card in cards)
        {
            Assert.Equal(ScanResultType.Joined, (await ScanAsync(board, t, card)).Scan!.Result);
        }

        return (await GetBoard(board, t)).Roster!.Players;
    }

    private async Task<ScoreboardStateResponse> GenerateAsync(TestDevice board, TestTable t)
    {
        var response = await PostAction(board, t,
            new { type = "generate_teams", expected_version = (await GetBoard(board, t)).Version });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadDeviceJson<ScoreboardStateResponse>(response);
    }

    private static string MyCards(TestTable t) => $"api/v3/organizations/{t.Org.Id}/me/cards";

    /// <summary>What an unknown-card scan will create (the scan action itself is pending ux's spec).</summary>
    private async Task<string> SeedCardLinkAsync(TestTable t, string uid, TimeSpan? expiresIn = null)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        await dbContext.CardLinkRequests.Where(r => r.TableId == t.TableId).ExecuteDeleteAsync();
        var request = new CardLinkRequest
        {
            OrganizationId = t.Org.Id,
            TableId = t.TableId,
            UidHmac = scope.ServiceProvider.GetRequiredService<CardUidHasher>().Hash(t.Org.Id, uid)!,
            ExpiresAt = DateTimeOffset.UtcNow + (expiresIn ?? TimeSpan.FromMinutes(10)),
        };
        dbContext.CardLinkRequests.Add(request);
        await dbContext.SaveChangesAsync();
        return request.ShortCode;
    }

    private async Task<TestTable> SetupTableAsync()
    {
        var org = await CreateOrganization("Office", "office");
        var league = await CreateLeague(org.Id, "Foosball", "foosball", teamSize: 2, winningScore: 10);
        await CreateSeason(org.Id, league.Id);
        await SeedTestUser(org.Id, league.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner");

        var token = await RotateTokenAsync(org.Id);
        var created = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/admin/tables",
            new UpsertTableRequest { Name = "Table 1", LeagueId = league.Id, EndLabelA = "Window", EndLabelB = "Door" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var table = await ReadJsonAsync<TableResponse>(created);
        return new TestTable(org, league, table!.Id, token);
    }

    private async Task<string> RotateTokenAsync(Guid orgId)
    {
        AuthenticateAs("owner");
        var response = await Client.PostAsync($"api/v3/organizations/{orgId}/admin/device-enrolment-token", null);
        return (await ReadJsonAsync<EnrolmentTokenResponse>(response))!.Token;
    }

    private async Task<TestDevice> ClaimAsync(TestTable t, DeviceRole role, TableEnd end)
    {
        var device = TestDevice.New();
        Assert.Equal(HttpStatusCode.NotFound, (await GetConfig(device, t.Token)).StatusCode);
        AuthenticateAs("owner");
        var response = await Client.PutAsJsonAsync($"{t.Admin}/devices/{device.Id}",
            new AssignDeviceRequest { Role = role, TableId = t.TableId, End = end });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return device;
    }

    private async Task<List<Guid>> SeedPlayersAsync(TestTable t, params string[] ids)
    {
        var players = new List<Guid>();
        foreach (var id in ids)
        {
            var (_, _, player) = await SeedTestUser(t.Org.Id, t.League.Id, id, $"{id}@test.com");
            players.Add(player.Id);
        }

        AuthenticateAs("owner");
        return players;
    }

    private async Task<ActiveMatchResponse> CreateActiveMatchAsync(TestTable t)
    {
        string[] ids = ["p1", "p2", "p3", "p4"];
        await SeedPlayersAsync(t, ids);
        foreach (var id in ids)
        {
            AuthenticateAs(id);
            await Client.PostAsync($"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/queue", null);
        }

        await RunMatchMakingCycleAsync();
        AuthenticateAs("p1");
        var queue = await ReadJsonAsync<QueueStatusResponse>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/queue"));
        foreach (var id in ids)
        {
            AuthenticateAs(id);
            await Client.PostAsync(
                $"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/pending-matches/{queue!.PendingMatch!.Id}/accept",
                null);
        }

        return Assert.Single(await ListActiveMatchesAsync(t));
    }

    private async Task<List<ActiveMatchResponse>> ListActiveMatchesAsync(TestTable t)
    {
        AuthenticateAs("owner");
        return (await ReadJsonAsync<List<ActiveMatchResponse>>(
            await Client.GetAsync($"api/v3/organizations/{t.Org.Id}/leagues/{t.League.Id}/active-matches")))!;
    }

    private async Task ShiftMatchesAsync(TimeSpan endedAt, TimeSpan startedAt)
    {
        var now = DateTimeOffset.UtcNow;
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        await dbContext.TableMatches.ExecuteUpdateAsync(s => s
            .SetProperty(m => m.StartedAt, now + startedAt)
            .SetProperty(m => m.EndedAt, now + endedAt));
    }

    private async Task AgeLiveMatchesAsync(TimeSpan age)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        await dbContext.TableMatches.Where(m => m.Status == TableMatchStatus.Live)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.LastActivityAt, m => m.LastActivityAt - age));
    }

    private static HttpRequestMessage DeviceRequest(TestDevice device, TestTable? t, HttpMethod method, string path,
        object? body = null, string? token = null)
    {
        var request = new HttpRequestMessage(method, $"api/v3/hardware/{path}");
        request.Headers.Add("X-Device-Id", device.Id);
        request.Headers.TryAddWithoutValidation("Authorization", $"Device {device.Secret}");
        if ((token ?? t?.Token) is { } enrolmentToken)
        {
            request.Headers.Add("X-Enrolment-Token", enrolmentToken);
        }

        if (body is not null)
        {
            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        }

        return request;
    }

    private Task<HttpResponseMessage> DeviceSend(TestDevice device, TestTable t, HttpMethod method, string path,
        object? body = null) => Client.SendAsync(DeviceRequest(device, t, method, path, body));

    private Task<HttpResponseMessage> GetConfig(TestDevice device, string? token) =>
        Client.SendAsync(DeviceRequest(device, null, HttpMethod.Get, $"devices/{device.Id}/config", token: token));

    private Task<HttpResponseMessage> PostGoal(TestDevice device, TestTable t, int seq, string? tableId = "",
        DateTimeOffset? occurredAt = null, bool nullOccurredAt = false, HttpClient? client = null) =>
        (client ?? Client).SendAsync(DeviceRequest(device, t, HttpMethod.Post, "goal-events", new
        {
            event_id = $"{device.Id}-0000beef-{seq}",
            device_id = device.Id,
            seq,
            occurred_at = nullOccurredAt ? (DateTimeOffset?)null : occurredAt ?? DateTimeOffset.UtcNow,
            uptime_ms = 1000 * seq,
            table_id = tableId == "" ? t.TableId.ToString() : tableId,
            goal = (string?)null,
            battery_mv = 3900,
            firmware_version = "0.1.0",
        }));

    private async Task<ScoreboardStateResponse> GetBoard(TestDevice board, TestTable t)
    {
        var response = await DeviceSend(board, t, HttpMethod.Get, $"devices/{board.Id}/scoreboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadDeviceJson<ScoreboardStateResponse>(response);
    }

    private Task<HttpResponseMessage> PostAction(TestDevice board, TestTable t, object action) =>
        DeviceSend(board, t, HttpMethod.Post, $"devices/{board.Id}/scoreboard/actions", action);

    private static async Task<T> ReadDeviceJson<T>(HttpResponseMessage response) =>
        JsonSerializer.Deserialize<T>(await response.Content.ReadAsStringAsync(), DeviceJson.Options)!;
}
