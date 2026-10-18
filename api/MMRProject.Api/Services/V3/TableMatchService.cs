using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Extensions;
using Npgsql;

namespace MMRProject.Api.Services.V3;

public interface ITableMatchService
{
    /// <returns>False when <c>event_id</c> was already recorded.</returns>
    Task<bool> RecordGoalAsync(Device device, GoalEventRequest request);

    /// <summary>A goal counter's undo button (only its own goal, within <c>undo_window_s</c>).</summary>
    /// <returns>Duplicate when this undo <c>event_id</c> was already applied; a refusal when it can't be.</returns>
    Task<(bool Duplicate, UndoRefusal? Refusal)> RecordUndoAsync(Device device, UndoEventRequest request);

    Task RecordStatusAsync(Device device, DeviceStatusRequest request, string rawJson);

    /// <summary><c>Hardware:DeviceUndoWindowSeconds</c>: served as <c>undo_window_s</c> and enforced on undo events.</summary>
    int UndoWindowSeconds { get; }

    /// <returns>Null when the device is not an assigned scoreboard.</returns>
    Task<ScoreboardStateResponse?> GetScoreboardStateAsync(Device device);

    /// <returns>True when the table's state version differs from <paramref name="since"/> within <paramref name="wait"/>.</returns>
    Task<bool> WaitForChangeAsync(Guid tableId, long since, TimeSpan wait, CancellationToken cancellationToken);

    /// <returns>Applied = false when <c>expected_version</c> is stale (nothing was done).</returns>
    Task<(bool Applied, ScoreboardStateResponse State)> ApplyScoreboardActionAsync(Device device,
        ScoreboardActionRequest request);

    Task<LiveTableResponse> GetLiveTableAsync(Guid orgId, Guid tableId);

    /// <summary>The phone's new game, as on the scoreboard, recording the member. 409 when <paramref name="expectedVersion"/> is stale.</summary>
    Task<LiveTableResponse> StartNewGameAsync(Guid orgId, Guid tableId, bool save, long expectedVersion);
    Task<List<TableMatchResponse>> GetClaimableMatchesAsync(Guid orgId, Guid? tableId);
    Task<MatchResponse> ClaimMatchAsync(Guid orgId, Guid leagueId, Guid tableMatchId, ClaimTableMatchRequest request);
    Task<LiveTableResponse> LinkActiveMatchAsync(Guid orgId, Guid leagueId, Guid activeMatchId, LinkTableRequest request);

    Task<ShortLinkResponse> ResolveShortLinkAsync(string code);

    Task<MatchGoalsResponse> GetGoalsAsync(Guid orgId, TableMatchRef matchRef);

    /// <summary>Sets or clears a counted goal's scorer after the fact (players of the match, or moderators).</summary>
    Task<MatchGoalResponse> SetGoalScorerAsync(Guid orgId, TableMatchRef matchRef, Guid goalId, Guid? leaguePlayerId);

    /// <summary>Adds a member to the table's roster, as a scan of their card would (a card just linked in the app).</summary>
    Task<ScanResultType> JoinRosterAsync(Guid tableId, Guid membershipId);

    /// <summary>Closes live matches with no activity for the live-match timeout.</summary>
    Task<int> CloseStaleMatchesAsync();

    /// <summary>Rates the finished linked matches whose auto-submit time has come. Safe to run on every replica.</summary>
    Task<int> SubmitDueMatchesAsync();
}

/// <summary>A table match by its rated match (in a league), or by its own id.</summary>
public record TableMatchRef(Guid? LeagueId, Guid? MatchId, Guid? TableMatchId);

/// <summary>
/// Wakes scoreboard long-polls when a table changes.
/// </summary>
// ponytail: in-process only. Waiters also re-check the database every 2 s, so with several API
// replicas (or during a revision swap) a change on another replica shows within ~2 s instead of at
// once. Move to Postgres LISTEN/NOTIFY if that latency matters.
public sealed class TableStateNotifier
{
    private readonly ConcurrentDictionary<Guid, TaskCompletionSource> _waiters = new();

    public Task WaitAsync(Guid tableId) =>
        _waiters.GetOrAdd(tableId, _ => new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously)).Task;

    public void Notify(Guid tableId)
    {
        if (_waiters.TryRemove(tableId, out var waiter))
        {
            waiter.TrySetResult();
        }
    }
}

public class TableMatchService(
    ApiDbContext dbContext,
    IV3MatchesService matchesService,
    IV3MatchMakingService matchMakingService,
    IOrganizationService organizationService,
    TableStateNotifier notifier,
    CardUidHasher cardUidHasher,
    IConfiguration configuration,
    ILogger<TableMatchService> logger) : ITableMatchService
{
    private static readonly TimeSpan PollRecheck = TimeSpan.FromSeconds(2);

    // Goals are attributed by server receipt time. A device's occurred_at (NTP, or null when unsynced) only
    // marks a goal as queued from an earlier game when it is this much older than where receipt puts it.
    private static readonly TimeSpan OccurredAtTolerance = TimeSpan.FromSeconds(60);

    // A goal counter reports "sleep" after idle_timeout_s without goals or movement. Only close a match
    // on it when the server saw no activity recently either (the other devices may still be busy).
    private static readonly TimeSpan SleepCloseGuard = TimeSpan.FromMinutes(2);

    private static readonly TimeSpan CardLinkLifetime = TimeSpan.FromMinutes(10);

    // A lobby nobody has joined for this long is cleared (ux: SCOREBOARD-UI §Scan-in, timeouts).
    private static readonly TimeSpan RosterIdleTimeout = TimeSpan.FromMinutes(30);

    private TimeSpan ClaimWindow =>
        TimeSpan.FromDays(configuration.GetValue("Hardware:ClaimWindowDays", 7));

    /// <summary>0 = off: linked matches then wait for a confirm on the board or a claim in the app.</summary>
    private TimeSpan AutoSubmitDelay =>
        TimeSpan.FromSeconds(configuration.GetValue("Hardware:AutoSubmitDelaySeconds", 10));

    /// <summary>How long after a goal arrived its counter's undo button may undo it.</summary>
    public int UndoWindowSeconds => configuration.GetValue("Hardware:DeviceUndoWindowSeconds", 10);

    private static readonly TimeSpan JustEndedLive = TimeSpan.FromMinutes(2);

    private TimeSpan LiveMatchTimeout =>
        TimeSpan.FromMinutes(configuration.GetValue("Hardware:LiveMatchTimeoutMinutes", 30));

    // ---- Device side ----

    public async Task<bool> RecordGoalAsync(Device device, GoalEventRequest request)
    {
        if (await dbContext.TableGoals.AnyAsync(g => g.EventId == request.EventId))
        {
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        var goal = new TableGoal
        {
            OrganizationId = device.OrganizationId,
            EventId = request.EventId,
            DeviceId = device.Id,
            Seq = request.Seq,
            OccurredAt = request.OccurredAt,
            ReceivedAt = now,
            BatteryMv = request.BatteryMv,
        };

        try
        {
            if (device is not { Claimed: true, Role: DeviceRole.Goal, TableId: { } tableId, End: { } goalEnd })
            {
                await AddOrphanAsync(goal, OrphanReason.UnassignedDevice);
            }
            else if (request.TableId is not null && request.TableId != tableId.ToString())
            {
                // Queued before the device moved to this table.
                goal.ScoringEnd = Opposite(goalEnd);
                await AddOrphanAsync(goal, OrphanReason.OtherTable);
            }
            else
            {
                await MutateTableAsync(tableId, async table =>
                {
                    dbContext.TableGoals.Add(goal);
                    return (true, await ApplyGoalAsync(table, goalEnd, goal, now));
                });
            }
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           {
                                               SqlState: PostgresErrorCodes.UniqueViolation,
                                               ConstraintName: "ix_table_goals_event_id"
                                           })
        {
            dbContext.Entry(goal).State = EntityState.Detached;
            return false;
        }

        return true;
    }

    public async Task<(bool Duplicate, UndoRefusal? Refusal)> RecordUndoAsync(Device device, UndoEventRequest request)
    {
        // Dedupe before any rule, so the retry of an undo that worked never reads as "too late".
        if (await dbContext.TableGoals.AnyAsync(g => g.UndoEventId == request.EventId))
        {
            return (true, null);
        }

        // Like its goals: an unassigned counter's undo changes nothing.
        if (device is not { Claimed: true, Role: DeviceRole.Goal })
        {
            return (false, null);
        }

        var target = await dbContext.TableGoals.AsNoTracking()
            .Where(g => g.EventId == request.UndoesEventId && g.DeviceId == device.Id)
            .Select(g => new { g.TableId })
            .FirstOrDefaultAsync();
        if (target is null)
        {
            return (false, UndoRefusal.NotYours);
        }

        if (target.TableId is not { } tableId)
        {
            return (false, UndoRefusal.Closed);
        }

        return await MutateTableAsync(tableId, async _ =>
        {
            var now = DateTimeOffset.UtcNow;
            var goal = await dbContext.TableGoals.FirstAsync(g => g.EventId == request.UndoesEventId);
            if (goal.UndoEventId == request.EventId)
            {
                return ((true, (UndoRefusal?)null), false);
            }

            if (goal.UndoneAt is not null)
            {
                return ((false, UndoRefusal.AlreadyUndone), false);
            }

            var match = await CurrentMatchAsync(tableId);
            if (goal.TableMatchId is null || match?.Id != goal.TableMatchId ||
                match.Status is not (TableMatchStatus.Live or TableMatchStatus.Finished))
            {
                return ((false, UndoRefusal.Closed), false);
            }

            if (now - goal.ReceivedAt > TimeSpan.FromSeconds(UndoWindowSeconds))
            {
                return ((false, UndoRefusal.TooLate), false);
            }

            UndoGoal(match, goal, now);
            goal.UndoEventId = request.EventId;
            return ((false, (UndoRefusal?)null), true);
        });
    }

    /// <summary>
    /// Puts an accepted goal in a match; never drops it. By receipt it belongs to the live match (or opens
    /// one). Only when occurred_at says it is clearly older (queued while offline) does it go to the
    /// earlier claimable match it happened in; if none fits it is kept as an orphan.
    /// </summary>
    /// <returns>Whether a match changed.</returns>
    private async Task<bool> ApplyGoalAsync(FoosballTable table, TableEnd goalEnd, TableGoal goal, DateTimeOffset now)
    {
        goal.TableId = table.Id;
        goal.ScoringEnd = Opposite(goalEnd);
        bool ClearlyBefore(DateTimeOffset time) => goal.OccurredAt < time - OccurredAtTolerance;

        var current = await CurrentMatchAsync(table.Id);
        TableMatch? match;
        if (current?.Status == TableMatchStatus.Live)
        {
            match = ClearlyBefore(current.StartedAt) ? await EarlierMatchAsync(table.Id, goal.OccurredAt!.Value, now) : current;
        }
        else
        {
            match = ClearlyBefore(now) ? await EarlierMatchAsync(table.Id, goal.OccurredAt!.Value, now) : StartMatch(table, now);
        }

        if (match is null)
        {
            goal.OrphanReason = OrphanReason.NoMatch;
            LogOrphan(goal);
            return false;
        }

        goal.TableMatch = match;
        match.Goals.Add(goal);
        if (goal.ScoringEnd == TableEnd.A) match.ScoreA++;
        else match.ScoreB++;

        if (match.Status != TableMatchStatus.Live)
        {
            logger.LogInformation("Queued goal {EventId} (occurred {OccurredAt}) added to finished match {TableMatchId}",
                goal.EventId, goal.OccurredAt, match.Id);
            return true;
        }

        match.LastActivityAt = now;
        var winningScore = await WinningScoreAsync(table, match);
        if (winningScore is { } target && Math.Max(match.ScoreA, match.ScoreB) >= target)
        {
            match.Status = TableMatchStatus.Finished;
            match.EndedAt = now;
            // A linked match won outright is rated shortly after, unless someone undoes the goal first.
            if (match.ActiveMatchId is not null && AutoSubmitDelay > TimeSpan.Zero)
            {
                match.AutoSubmitAt = now + AutoSubmitDelay;
            }
        }

        return true;
    }

    /// <summary>The newest claimable (finished, unsubmitted) match on the table that was on at <paramref name="occurredAt"/>.</summary>
    private Task<TableMatch?> EarlierMatchAsync(Guid tableId, DateTimeOffset occurredAt, DateTimeOffset now)
    {
        var claimableSince = now - ClaimWindow;
        return dbContext.TableMatches
            .Include(m => m.Goals.Where(g => g.UndoneAt == null))
            .Where(m => m.TableId == tableId && m.Status == TableMatchStatus.Finished && m.EndedAt >= claimableSince)
            .Where(m => m.StartedAt - OccurredAtTolerance <= occurredAt && occurredAt <= m.EndedAt + OccurredAtTolerance)
            .OrderByDescending(m => m.StartedAt)
            .FirstOrDefaultAsync();
    }

    private async Task AddOrphanAsync(TableGoal goal, OrphanReason reason)
    {
        goal.OrphanReason = reason;
        dbContext.TableGoals.Add(goal);
        await dbContext.SaveChangesAsync();
        LogOrphan(goal);
    }

    private void LogOrphan(TableGoal goal) =>
        logger.LogWarning(
            "Orphan goal {EventId} from device {DevicePk} (table {TableId}, occurred {OccurredAt}, received {ReceivedAt}): {OrphanReason}",
            goal.EventId, goal.DeviceId, goal.TableId, goal.OccurredAt, goal.ReceivedAt, goal.OrphanReason);

    private static TableEnd Opposite(TableEnd end) => end == TableEnd.A ? TableEnd.B : TableEnd.A;

    public async Task RecordStatusAsync(Device device, DeviceStatusRequest request, string rawJson)
    {
        var now = DateTimeOffset.UtcNow;
        device.BatteryMv = request.BatteryMv;
        device.LowBatt = request.LowBatt;
        device.FirmwareVersion = request.FirmwareVersion;
        device.LastStatusAt = now;
        device.LastStatus = rawJson;
        // A beam status comes mid-wake; every other one ends the wake.
        if (request.Reason != DeviceStatusReason.Beam) device.AwakeSince = null;
        // The wake's history row (METRICS §8.3 v2): in use from waking until the idle timeout began.
        if (request is { Reason: DeviceStatusReason.Sleep, UptimeMs: { } uptimeMs } && device is { Claimed: true, TableId: { } wakeTableId })
        {
            var wokeAt = now - TimeSpan.FromMilliseconds(uptimeMs);
            dbContext.DeviceWakes.Add(new DeviceWake
            {
                OrganizationId = device.OrganizationId,
                DeviceId = device.Id,
                TableId = wakeTableId,
                WokeAt = wokeAt,
                IdleFrom = wokeAt > now - TableOccupancy.IdleTimeout ? wokeAt : now - TableOccupancy.IdleTimeout,
            });
        }

        await dbContext.SaveChangesAsync();

        if (request.Reason != DeviceStatusReason.Sleep || !device.Claimed || device.TableId is not { } tableId)
        {
            return;
        }

        // "Table idle": close an abandoned live match.
        await MutateTableAsync(tableId, async _ =>
        {
            var match = await CurrentMatchAsync(tableId);
            if (match is not { Status: TableMatchStatus.Live } || match.LastActivityAt > now - SleepCloseGuard)
            {
                return (0, false);
            }

            await CloseIdleAsync(match, now);
            return (0, true);
        });
    }

    public async Task<ScoreboardStateResponse?> GetScoreboardStateAsync(Device device)
    {
        if (device is not { Claimed: true, Role: DeviceRole.Scoreboard, TableId: { } tableId })
        {
            return null;
        }

        var table = await dbContext.FoosballTables.AsNoTracking().FirstAsync(t => t.Id == tableId);
        var match = await CurrentMatchAsync(tableId, track: false);
        if (match?.Status == TableMatchStatus.Discarded)
        {
            match = null;
        }

        var roster = await LoadRosterViewAsync(table, match);
        return new ScoreboardStateResponse
        {
            Version = table.StateVersion,
            TableName = table.Name,
            TableUrl = HardwareMapping.ShortUrl(configuration, table.ShortCode),
            // The shown match waits to be claimed (or, when linked, confirmed).
            NeedsClaim = match?.Status == TableMatchStatus.Finished,
            ClaimUrl = match is { Status: TableMatchStatus.Finished }
                ? HardwareMapping.ShortUrl(configuration, match.ShortCode)
                : null,
            Match = match is null ? null : await MapScoreboardMatchAsync(table, match, device.End ?? TableEnd.A),
            Roster = roster is not null
                ? new ScoreboardRoster
                {
                    LeagueName = Truncate(roster.League.Name, 24),
                    TeamSize = roster.League.TeamSize,
                    Players = roster.Players.Select(ToScoreboardPlayer).ToList(),
                    CanGenerate = roster.CanGenerate,
                    Link = roster.Link is { } link && HardwareMapping.ShortUrl(configuration, link.ShortCode) is { } url
                        ? new RosterLink
                        {
                            Url = url,
                            ExpiresInS = (int)Math.Max(0, (link.ExpiresAt - DateTimeOffset.UtcNow).TotalSeconds),
                        }
                        : null,
                }
                : null,
        };
    }

    public async Task<bool> WaitForChangeAsync(Guid tableId, long since, TimeSpan wait,
        CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow + wait;
        while (true)
        {
            // Register before reading so a change between the read and the wait isn't missed.
            var changed = notifier.WaitAsync(tableId);
            var version = await dbContext.FoosballTables.AsNoTracking()
                .Where(t => t.Id == tableId)
                .Select(t => (long?)t.StateVersion)
                .FirstOrDefaultAsync(cancellationToken);
            if (version != since)
            {
                return true;
            }

            var remaining = deadline - DateTimeOffset.UtcNow;
            if (remaining <= TimeSpan.Zero)
            {
                return false;
            }

            try
            {
                await changed.WaitAsync(remaining < PollRecheck ? remaining : PollRecheck, cancellationToken);
            }
            catch (TimeoutException)
            {
            }
        }
    }

    public async Task<(bool Applied, ScoreboardStateResponse State)> ApplyScoreboardActionAsync(Device device,
        ScoreboardActionRequest request)
    {
        if (device is not { Claimed: true, Role: DeviceRole.Scoreboard, TableId: { } tableId })
        {
            throw new NotFoundException("Device is not assigned to a table");
        }

        ScanResult? scan = null;
        var applied = await MutateTableAsync(tableId, async table =>
        {
            var now = DateTimeOffset.UtcNow;
            var match = await CurrentMatchAsync(tableId);

            // A tap is a fact, not an edit of what the player saw: no version check, never 409.
            if (request.Type == ScoreboardActionType.Scan)
            {
                (scan, var scanChanged) = await ScanAsync(table, match, request.Uid!, now);
                return (true, scanChanged);
            }

            if (request.ExpectedVersion != table.StateVersion)
            {
                return (false, false);
            }

            switch (request.Type)
            {
                case ScoreboardActionType.UndoLastGoal:
                    UndoLastGoal(match, now);
                    break;
                case ScoreboardActionType.NewGame:
                    if (!await NewGameAsync(table, match, request.Save ?? true, now))
                    {
                        return (true, false);
                    }

                    break;
                case ScoreboardActionType.AssignScorer:
                    await AssignScorerAsync(match, request.GoalId, request.PlayerId);
                    break;
                case ScoreboardActionType.SwapSides:
                    SwapSides(match, now);
                    break;
                case ScoreboardActionType.RemovePlayer:
                    await RemovePlayerAsync(match, tableId, request.PlayerId, now);
                    break;
                case ScoreboardActionType.GenerateTeams:
                    await GenerateTeamsAsync(table, match, device.End ?? TableEnd.A, request.Mode ?? TeamsMode.Fair, request.Teams, now);
                    break;
            }

            return (true, true);
        });

        var state = await GetScoreboardStateAsync(device)
                    ?? throw new NotFoundException("Device is not assigned to a table");
        return (applied, state with { Scan = scan });
    }

    public async Task<LiveTableResponse> StartNewGameAsync(Guid orgId, Guid tableId, bool save, long expectedVersion)
    {
        if (!await dbContext.FoosballTables.AnyAsync(t => t.Id == tableId && t.OrganizationId == orgId))
        {
            throw new NotFoundException("Table not found");
        }

        var membershipId = (await organizationService.GetMembershipForCurrentUserAsync(orgId))?.Id;
        var applied = await MutateTableAsync(tableId, async table =>
        {
            if (expectedVersion != table.StateVersion)
            {
                return (false, false);
            }

            var now = DateTimeOffset.UtcNow;
            var match = await CurrentMatchAsync(tableId);
            if (!await NewGameAsync(table, match, save, now))
            {
                return (true, false);
            }

            if (match is not null) match.EndedByMembershipId = membershipId;
            return (true, true);
        });

        if (!applied)
        {
            throw new ConflictException("The score changed: check it and try again");
        }

        return await GetLiveTableAsync(orgId, tableId);
    }

    private static void UndoLastGoal(TableMatch? match, DateTimeOffset now)
    {
        var lastGoal = match is { Status: TableMatchStatus.Live or TableMatchStatus.Finished }
            ? match.Goals.Where(g => g.UndoneAt == null).MaxBy(g => g.ReceivedAt)
            : null;
        if (match is null || lastGoal is null)
        {
            throw new UnprocessableException(match?.Status == TableMatchStatus.Submitted
                ? "This match has already been submitted"
                : "No goal to undo");
        }

        UndoGoal(match, lastGoal, now);
    }

    /// <summary>A finished match goes live again, and a pending auto-submit is cancelled.</summary>
    private static void UndoGoal(TableMatch match, TableGoal goal, DateTimeOffset now)
    {
        goal.UndoneAt = now;
        match.AutoSubmitAt = null;
        if (goal.ScoringEnd == TableEnd.A) match.ScoreA--;
        else match.ScoreB--;
        match.Status = TableMatchStatus.Live;
        match.EndedAt = null;
        match.LastActivityAt = now;
    }

    /// <summary>
    /// Live: Save → finished (the board shows the result and its claim QR); Discard → gone (a linked game
    /// restarts at 0 : 0 with the same teams). Finished: starts a new game. For a linked game this press is
    /// the players' confirmation, so a valid result is submitted, and it is a rematch: the same teams at
    /// the same ends, at 0 : 0.
    /// </summary>
    /// <returns>False when nothing changed (a new game at 0 : 0).</returns>
    private async Task<bool> NewGameAsync(FoosballTable table, TableMatch? match, bool save, DateTimeOffset now)
    {
        if (match?.Status == TableMatchStatus.Live)
        {
            if (match.ScoreA + match.ScoreB == 0)
            {
                return false;
            }

            match.EndedAt = now;
            if (save)
            {
                match.Status = TableMatchStatus.Finished;
                return true;
            }

            match.Status = TableMatchStatus.Discarded;
            if (match.ActiveMatchId is not null)
            {
                var restart = StartMatch(table, now);
                restart.ActiveMatchId = match.ActiveMatchId;
                restart.ActiveMatchTeamIndexAtEndA = match.ActiveMatchTeamIndexAtEndA;
                restart.OwnsActiveMatch = match.OwnsActiveMatch;
                restart.TeamsMode = match.TeamsMode;
                match.OwnsActiveMatch = false;
            }

            return true;
        }

        var settled = await SettleLinkedAsync(table, match, now);
        if (settled is null && await RosterLeagueAsync(table) is not null)
        {
            ClearBoard(table, now);
            return true;
        }

        var next = StartMatch(table, now);
        if (settled is { } rematch)
        {
            var activeMatch = await matchMakingService.CreateActiveMatchAsync(table.OrganizationId, rematch.LeagueId,
                rematch.Teams);
            next.ActiveMatchId = activeMatch.Id;
            next.ActiveMatchTeamIndexAtEndA = rematch.IndexAtEndA;
            next.OwnsActiveMatch = true;
            next.TeamsMode = match!.TeamsMode;
            await SetRosterAsync(table, rematch.Teams.SelectMany(t => t).ToList());
        }

        return true;
    }

    /// <summary>
    /// Moving on from a finished linked game: submits a valid result; otherwise drops the table's own active
    /// match (the game then stays claimable as an unlinked one).
    /// </summary>
    /// <returns>Its teams and ends, for a rematch; null when the game wasn't linked.</returns>
    private async Task<(Guid LeagueId, List<List<Guid>> Teams, int IndexAtEndA)?> SettleLinkedAsync(
        FoosballTable table, TableMatch? match, DateTimeOffset now)
    {
        // Rated already (auto-submitted, or claimed in the app): a rematch of its teams.
        if (match is { Status: TableMatchStatus.Submitted, MatchId: { } matchId })
        {
            var ratedTeams = (await TeamsAsync(match)).Select(t => t.ToList()).ToList();
            return ratedTeams.All(t => t.Count > 0)
                ? (await dbContext.Set<V3Match>().Where(m => m.Id == matchId).Select(m => m.LeagueId).FirstAsync(),
                    ratedTeams, 0)
                : null;
        }

        if (match is not { Status: TableMatchStatus.Finished, ActiveMatchId: { } activeMatchId })
        {
            return null;
        }

        var leagueId = await dbContext.V3ActiveMatches.Where(am => am.Id == activeMatchId)
            .Select(am => am.LeagueId).FirstAsync();
        var teams = await dbContext.PendingMatchTeams.AsNoTracking()
            .Where(t => t.PendingMatch.Id == dbContext.V3ActiveMatches
                .Where(am => am.Id == activeMatchId).Select(am => am.PendingMatchId).FirstOrDefault())
            .OrderBy(t => t.Index)
            .Select(t => t.Players.OrderBy(p => p.Index).Select(p => p.LeaguePlayerId).ToList())
            .ToListAsync();
        var indexAtEndA = match.ActiveMatchTeamIndexAtEndA;

        if (IsCompleteResult(match.ScoreA, match.ScoreB, await WinningScoreAsync(table, match)))
        {
            await SubmitLinkedAsync(match, await RosterMembershipIdAsync(activeMatchId), now);
        }
        else
        {
            await DropOwnedActiveMatchAsync(match);
        }

        return (leagueId, teams, indexAtEndA);
    }

    private async Task DropOwnedActiveMatchAsync(TableMatch match)
    {
        if (match is { OwnsActiveMatch: true, ActiveMatchId: { } activeMatchId })
        {
            match.AutoSubmitAt = null;
            match.ActiveMatchId = null;
            match.OwnsActiveMatch = false;
            await matchMakingService.DeleteActiveMatchAsync(activeMatchId);
        }
    }

    private async Task AssignScorerAsync(TableMatch? match, string? goalId, string? playerId)
    {
        // A submitted match too: the who-scored window can outlast the auto-submit.
        var goal = match is { Status: TableMatchStatus.Live or TableMatchStatus.Finished or TableMatchStatus.Submitted } &&
                   Guid.TryParse(goalId, out var goalGuid)
            ? match.Goals.FirstOrDefault(g => g.Id == goalGuid && g.UndoneAt == null)
            : null;
        if (goal is null)
        {
            throw new NotFoundException("Goal not found");
        }

        if (playerId is null)
        {
            goal.ScorerLeaguePlayerId = null;
            return;
        }

        var roster = await LoadRosterAsync(match!);
        if (!Guid.TryParse(playerId, out var playerGuid) ||
            !roster.Values.SelectMany(p => p).Any(p => p.LeaguePlayerId == playerGuid))
        {
            throw new NotFoundException("Player not in this match");
        }

        goal.ScorerLeaguePlayerId = playerGuid;
    }

    private static void SwapSides(TableMatch? match, DateTimeOffset now)
    {
        if (match is not { Status: TableMatchStatus.Live, ActiveMatchId: not null } || match.ScoreA + match.ScoreB > 0)
        {
            throw new UnprocessableException("Sides can only be swapped before the first goal of a linked match");
        }

        match.ActiveMatchTeamIndexAtEndA = 1 - match.ActiveMatchTeamIndexAtEndA;
        match.LastActivityAt = now;
    }

    // ---- Roster (scan-in) ----

    /// <summary>A game is on: its first goal locks the line-up until it ends.</summary>
    private static bool IsStarted(TableMatch? match) =>
        match is { Status: TableMatchStatus.Live } && match.ScoreA + match.ScoreB > 0;

    /// <summary>The line-up can change: the lobby, or teams made (a 0:0 linked match).</summary>
    private static bool RosterEditable(TableMatch? match) =>
        match is null or { Status: TableMatchStatus.Discarded } || match is { Status: TableMatchStatus.Live } && !IsStarted(match);

    private static bool IsOver(TableMatch? match) =>
        match is { Status: TableMatchStatus.Finished or TableMatchStatus.Submitted };

    /// <summary>The table's league when it can scan in: a card key is configured and the league fits the board.</summary>
    private async Task<League?> RosterLeagueAsync(FoosballTable table) =>
        cardUidHasher.IsConfigured
            ? await dbContext.Leagues.AsNoTracking().FirstOrDefaultAsync(l => l.Id == table.LeagueId && l.TeamSize <= 2)
            : null;

    private Task<List<TableRosterEntry>> RosterEntriesAsync(Guid tableId) =>
        dbContext.TableRosterEntries
            .Include(e => e.LeaguePlayer).ThenInclude(lp => lp.OrganizationMembership).ThenInclude(m => m.User)
            .Where(e => e.TableId == tableId)
            .OrderBy(e => e.CreatedAt).ThenBy(e => e.Id)
            .ToListAsync();

    private async Task<(ScanResult Result, bool Changed)> ScanAsync(FoosballTable table, TableMatch? match, string uid,
        DateTimeOffset now)
    {
        if (!cardUidHasher.IsConfigured)
        {
            return (new ScanResult { Result = ScanResultType.Unavailable }, false);
        }

        var league = await RosterLeagueAsync(table);
        if (league is null)
        {
            return (new ScanResult { Result = ScanResultType.NoLeague }, false);
        }

        var hash = cardUidHasher.Hash(table.OrganizationId, uid) ?? throw new InvalidArgumentException("Invalid card UID");
        if (IsStarted(match))
        {
            return (new ScanResult { Result = ScanResultType.Locked }, false);
        }

        var membership = await dbContext.OrganizationMemberships.Include(m => m.User)
            .FirstOrDefaultAsync(m => dbContext.PlayerCards.Any(c =>
                c.OrganizationId == table.OrganizationId && c.UidHmac == hash && c.OrganizationMembershipId == m.Id));
        if (membership is not null)
        {
            return await JoinAsync(table, match, league, membership, now);
        }

        await LeaveFinishedAsync(table, match, now);
        var link = await dbContext.CardLinkRequests.FirstOrDefaultAsync(r => r.TableId == table.Id);
        if (link is null)
        {
            link = new CardLinkRequest { OrganizationId = table.OrganizationId, TableId = table.Id, UidHmac = hash };
            dbContext.CardLinkRequests.Add(link);
        }
        else if (!link.UidHmac.SequenceEqual(hash) || link.ExpiresAt <= now)
        {
            // One QR per table: a new unknown card replaces the last one's link.
            link.UidHmac = hash;
            link.ShortCode = ShortCode.New();
        }

        link.ExpiresAt = now + CardLinkLifetime;
        return (new ScanResult { Result = ScanResultType.UnknownCard }, true);
    }

    // ---- Goals (fix scorers in the app) ----

    public async Task<MatchGoalsResponse> GetGoalsAsync(Guid orgId, TableMatchRef matchRef)
    {
        var match = await FindTableMatchAsync(orgId, matchRef);
        var teams = await TeamsAsync(match);
        var counted = TableMatchStats.Counted(await dbContext.TableGoals.AsNoTracking()
            .Where(g => g.TableMatchId == match.Id).ToListAsync());

        var (a, b) = (0, 0);
        var goals = new List<MatchGoalResponse>();
        foreach (var goal in counted)
        {
            var team = goal.ScoringEnd == TableEnd.A ? 0 : 1;
            (a, b) = team == 0 ? (a + 1, b) : (a, b + 1);
            goals.Add(new MatchGoalResponse
            {
                Id = goal.Id,
                TeamIndex = team,
                At = TableMatchStats.EventTime(goal),
                ScoreA = a,
                ScoreB = b,
                ScorerLeaguePlayerId = goal.ScorerLeaguePlayerId,
                OwnGoal = goal.ScorerLeaguePlayerId is { } scorer && teams[1 - team].Contains(scorer),
            });
        }

        return new MatchGoalsResponse
        {
            TableMatchId = match.Id,
            MatchId = match.MatchId,
            TableName = match.Table.Name,
            CanEdit = await CanEditGoalsAsync(orgId, teams),
            Goals = goals,
        };
    }

    public async Task<MatchGoalResponse> SetGoalScorerAsync(Guid orgId, TableMatchRef matchRef, Guid goalId,
        Guid? leaguePlayerId)
    {
        var match = await FindTableMatchAsync(orgId, matchRef);
        if (!await dbContext.TableGoals.AnyAsync(g => g.Id == goalId && g.TableMatchId == match.Id && g.UndoneAt == null))
        {
            throw new NotFoundException("Goal not found");
        }

        var teams = await TeamsAsync(match);
        if (!await CanEditGoalsAsync(orgId, teams))
        {
            throw new ForbiddenException("Only the match's players or a moderator can change scorers");
        }

        if (leaguePlayerId is { } playerId && !teams.Any(t => t.Contains(playerId)))
        {
            throw new InvalidArgumentException("The player didn't play in this match");
        }

        // Through the table lock, so a board showing this match redraws.
        await MutateTableAsync(match.TableId, async _ =>
        {
            var goal = await dbContext.TableGoals.FirstAsync(g => g.Id == goalId);
            goal.ScorerLeaguePlayerId = leaguePlayerId;
            return (0, true);
        });

        return (await GetGoalsAsync(orgId, matchRef)).Goals.Single(g => g.Id == goalId);
    }

    private async Task<TableMatch> FindTableMatchAsync(Guid orgId, TableMatchRef matchRef) =>
        await dbContext.TableMatches.AsNoTracking().Include(m => m.Table)
            .Where(m => m.OrganizationId == orgId)
            .Where(m => matchRef.MatchId != null
                ? m.MatchId == matchRef.MatchId &&
                  dbContext.Set<V3Match>().Any(x => x.Id == matchRef.MatchId && x.LeagueId == matchRef.LeagueId)
                : m.Id == matchRef.TableMatchId)
            .FirstOrDefaultAsync()
        ?? throw new NotFoundException("Not a table match");

    private async Task<bool> CanEditGoalsAsync(Guid orgId, List<IReadOnlyList<Guid>> teams)
    {
        if (await organizationService.GetMembershipForCurrentUserAsync(orgId) is not
            { Status: MembershipStatus.Active } membership)
        {
            return false;
        }

        var players = teams.SelectMany(t => t).ToList();
        return membership.Role is OrganizationRole.Owner or OrganizationRole.Moderator ||
               await dbContext.LeaguePlayers.AnyAsync(lp =>
                   lp.OrganizationMembershipId == membership.Id && players.Contains(lp.Id));
    }

    public async Task<ScanResultType> JoinRosterAsync(Guid tableId, Guid membershipId)
    {
        return await MutateTableAsync(tableId, async table =>
        {
            // Changed either way: the card's link (the board's QR) has just been used up.
            var league = await RosterLeagueAsync(table);
            var match = await CurrentMatchAsync(tableId);
            if (league is null)
            {
                return (ScanResultType.NoLeague, true);
            }

            if (IsStarted(match))
            {
                return (ScanResultType.Locked, true);
            }

            var membership = await dbContext.OrganizationMemberships.Include(m => m.User)
                .FirstAsync(m => m.Id == membershipId);
            var (result, _) = await JoinAsync(table, match, league, membership, DateTimeOffset.UtcNow);
            return (result.Result, true);
        });
    }

    private async Task<(ScanResult Result, bool Changed)> JoinAsync(FoosballTable table, TableMatch? match,
        League league, OrganizationMembership membership, DateTimeOffset now)
    {
        var player = await matchesService.GetOrCreateLeaguePlayerAsync(table.OrganizationId, league.Id, membership);
        player.OrganizationMembership = membership;
        ScanResult Result(ScanResultType type, int color) => new()
        {
            Result = type,
            Player = ToScoreboardPlayer(ToTablePlayer(player, color)),
        };

        var busy = await dbContext.TableMatches.AnyAsync(m =>
            m.Status == TableMatchStatus.Live && m.TableId != table.Id && m.ActiveMatch != null &&
            m.ActiveMatch.PendingMatch.Teams.Any(t => t.Players.Any(p => p.LeaguePlayerId == player.Id)));
        if (busy)
        {
            return (Result(ScanResultType.Busy, PlayerColors.Preferred(membership.Id)), false);
        }

        var changed = await LeaveFinishedAsync(table, match, now);
        var entries = await RosterEntriesAsync(table.Id);
        if (entries.FirstOrDefault(e => e.LeaguePlayerId == player.Id) is { } entry)
        {
            return (Result(ScanResultType.AlreadyIn, entry.Color), changed);
        }

        if (entries.Count >= 2 * league.TeamSize)
        {
            return (Result(ScanResultType.RosterFull, PlayerColors.Preferred(membership.Id)), changed);
        }

        var color = PlayerColors.Assign(membership.Id, entries.Select(e => e.Color));
        dbContext.TableRosterEntries.Add(new TableRosterEntry
        {
            OrganizationId = table.OrganizationId,
            TableId = table.Id,
            LeaguePlayerId = player.Id,
            Color = color,
        });
        return (Result(ScanResultType.Joined, color), true);
    }

    /// <summary>
    /// A card tapped on a finished game starts the next one's lobby: like New game (a linked result is
    /// confirmed), but with a new line-up instead of a rematch.
    /// </summary>
    /// <returns>Whether the table moved on.</returns>
    private async Task<bool> LeaveFinishedAsync(FoosballTable table, TableMatch? match, DateTimeOffset now)
    {
        if (!IsOver(match))
        {
            return false;
        }

        await SettleLinkedAsync(table, match, now);
        await dbContext.TableRosterEntries.Where(e => e.TableId == table.Id).ExecuteDeleteAsync();
        ClearBoard(table, now);
        return true;
    }

    /// <summary>
    /// Leaves the table with no current match (the lobby): the next goal starts one. The finished game stays
    /// claimable; this only records that the board moved on.
    /// </summary>
    private void ClearBoard(FoosballTable table, DateTimeOffset now)
    {
        var cleared = StartMatch(table, now);
        cleared.Status = TableMatchStatus.Discarded;
        cleared.EndedAt = now;
    }

    private async Task RemovePlayerAsync(TableMatch? match, Guid tableId, string? playerId, DateTimeOffset now)
    {
        if (IsStarted(match))
        {
            throw new UnprocessableException("Players can't change while a game is on");
        }

        // A finished game's roster is empty (its players are only in the game).
        var entry = RosterEditable(match) && Guid.TryParse(playerId, out var leaguePlayerId)
            ? await dbContext.TableRosterEntries.FirstOrDefaultAsync(e => e.TableId == tableId && e.LeaguePlayerId == leaguePlayerId)
            : null;
        dbContext.TableRosterEntries.Remove(entry ?? throw new NotFoundException("Player not in the roster"));

        // Removing someone from made teams dissolves them: back to the lobby.
        if (match is { Status: TableMatchStatus.Live, ActiveMatchId: not null })
        {
            match.Status = TableMatchStatus.Discarded;
            match.EndedAt = now;
            await DropOwnedActiveMatchAsync(match);
        }
    }

    /// <param name="boardEnd">The board's end: its left side (manual teams are given left first).</param>
    private async Task GenerateTeamsAsync(FoosballTable table, TableMatch? match, TableEnd boardEnd, TeamsMode mode,
        List<List<string>>? manualTeams, DateTimeOffset now)
    {
        var league = await RosterLeagueAsync(table) ?? throw new UnprocessableException("This table can't scan players in");
        var entries = await RosterEntriesAsync(table.Id);
        // "Again": a re-draw of random teams before the first goal.
        var redraw = mode == TeamsMode.Random && RosterEditable(match) &&
                     match is { OwnsActiveMatch: true, ActiveMatchId: not null, TeamsMode: TeamsMode.Random };
        if (!RosterEditable(match) || match?.ActiveMatchId is not null && !redraw || entries.Count != 2 * league.TeamSize)
        {
            throw new UnprocessableException("Teams can be made once the roster is full");
        }

        var roster = entries.Select(e => e.LeaguePlayer).ToList();
        var teams = (mode switch
        {
            TeamsMode.Random => TeamBalancer.RandomSplit(roster),
            TeamsMode.Manual => ManualTeams(manualTeams, roster, league.TeamSize),
            _ => TeamBalancer.Split(roster),
        }).Select(t => t.Select(p => p.Id).ToList()).ToList();

        if (redraw)
        {
            // A different pairing (uniform among the others; 1v1 has none, so only the ends change).
            var current = await TeamsAsync(match!);
            bool Same(List<List<Guid>> split) => split.Any(t => t.ToHashSet().SetEquals(current[0]));
            while (roster.Count > 2 && Same(teams))
            {
                teams = TeamBalancer.RandomSplit(roster).Select(t => t.Select(p => p.Id).ToList()).ToList();
            }

            await DropOwnedActiveMatchAsync(match!);
        }

        var activeMatch = await matchMakingService.CreateActiveMatchAsync(table.OrganizationId, league.Id, teams);

        var linked = match is { Status: TableMatchStatus.Live } ? match : StartMatch(table, now);
        linked.StartedAt = now;
        linked.LastActivityAt = now;
        linked.ActiveMatchId = activeMatch.Id;
        // Manual teams come left first; the board's left is its own end.
        linked.ActiveMatchTeamIndexAtEndA = mode == TeamsMode.Manual && boardEnd == TableEnd.B ? 1 : 0;
        linked.OwnsActiveMatch = true;
        linked.TeamsMode = mode;

        // The unknown-card QR goes away once teams are made.
        await dbContext.CardLinkRequests.Where(r => r.TableId == table.Id).ExecuteDeleteAsync();
    }

    /// <summary>The board's own split: two teams of the team size, each roster player exactly once.</summary>
    private static List<List<LeaguePlayer>> ManualTeams(List<List<string>>? teams, List<LeaguePlayer> roster, int teamSize)
    {
        var byId = roster.ToDictionary(p => p.Id.ToString(), StringComparer.OrdinalIgnoreCase);
        if (teams is not { Count: 2 } || teams.Any(t => t is null || t.Count != teamSize) ||
            teams.SelectMany(t => t).Select(id => byId.GetValueOrDefault(id ?? "")).Distinct().Count(p => p != null) !=
            roster.Count)
        {
            throw new UnprocessableException($"Manual teams need two teams of {teamSize}, each roster player once");
        }

        return teams.Select(t => t.Select(id => byId[id]).ToList()).ToList();
    }

    /// <summary>Makes the roster exactly these players (a linked match's), keeping the colours of those already in.</summary>
    private async Task SetRosterAsync(FoosballTable table, List<Guid> leaguePlayerIds)
    {
        var entries = await RosterEntriesAsync(table.Id);
        dbContext.TableRosterEntries.RemoveRange(entries.Where(e => !leaguePlayerIds.Contains(e.LeaguePlayerId)));
        var kept = entries.Where(e => leaguePlayerIds.Contains(e.LeaguePlayerId)).ToList();
        var colors = kept.Select(e => e.Color).ToList();
        var memberships = await dbContext.LeaguePlayers.Where(lp => leaguePlayerIds.Contains(lp.Id))
            .ToDictionaryAsync(lp => lp.Id, lp => lp.OrganizationMembershipId);

        foreach (var leaguePlayerId in leaguePlayerIds.Where(id => kept.All(e => e.LeaguePlayerId != id)))
        {
            var color = PlayerColors.Assign(memberships[leaguePlayerId], colors);
            colors.Add(color);
            dbContext.TableRosterEntries.Add(new TableRosterEntry
            {
                OrganizationId = table.OrganizationId,
                TableId = table.Id,
                LeaguePlayerId = leaguePlayerId,
                Color = color,
            });
        }
    }

    private sealed record RosterView(League League, List<TablePlayerResponse> Players, bool CanGenerate, CardLinkRequest? Link);

    private async Task<RosterView?> LoadRosterViewAsync(FoosballTable table, TableMatch? match)
    {
        // Present whenever no game is on; on a finished one it is empty (a card starts a new lobby).
        if (IsStarted(match) || await RosterLeagueAsync(table) is not { } league)
        {
            return null;
        }

        if (IsOver(match))
        {
            return new RosterView(league, [], false, null);
        }

        var players = (await RosterEntriesAsync(table.Id)).Select(e => ToTablePlayer(e.LeaguePlayer, e.Color)).ToList();
        var link = await dbContext.CardLinkRequests.AsNoTracking()
            .FirstOrDefaultAsync(r => r.TableId == table.Id && r.ExpiresAt > DateTimeOffset.UtcNow);
        var canGenerate = players.Count == 2 * league.TeamSize && match?.ActiveMatchId is null;
        return new RosterView(league, players, canGenerate, link);
    }

    private static TablePlayerResponse ToTablePlayer(LeaguePlayer player, int? color) => new()
    {
        LeaguePlayerId = player.Id,
        DisplayName = player.OrganizationMembership.GetDisplayName(),
        Username = player.OrganizationMembership.GetUsername(),
        Color = color,
        ColorHex = color is { } c ? PlayerColors.Hex[c] : null,
    };

    // ---- App side ----

    public async Task<LiveTableResponse> GetLiveTableAsync(Guid orgId, Guid tableId)
    {
        var table = await dbContext.FoosballTables.AsNoTracking()
                        .FirstOrDefaultAsync(t => t.Id == tableId && t.OrganizationId == orgId)
                    ?? throw new NotFoundException("Table not found");
        var match = await CurrentMatchAsync(tableId, track: false);

        return new LiveTableResponse
        {
            Table = await HardwareMapping.MapTableAsync(dbContext, configuration, table),
            Version = table.StateVersion,
            Match = match is null || match.Status == TableMatchStatus.Discarded
                ? null
                : await MapTableMatchAsync(table, match),
            PreviousMatch = await PreviousMatchAsync(tableId),
            Roster = await LoadRosterViewAsync(table, match) is { } roster
                ? new TableRosterResponse
                {
                    LeagueId = roster.League.Id,
                    TeamSize = roster.League.TeamSize,
                    Players = roster.Players,
                    CanGenerate = roster.CanGenerate,
                }
                : null,
            Devices = (await dbContext.Devices.AsNoTracking()
                    .Where(d => d.TableId == tableId && d.Claimed && d.Role != null)
                    .OrderBy(d => d.Role).ThenBy(d => d.End)
                    .Select(d => new { d.Role, d.End, d.LowBatt, d.LastStatus, d.LastSeenAt })
                    .ToListAsync())
                .Select(d => new TableDeviceResponse
                {
                    Role = d.Role!.Value,
                    End = d.End,
                    LowBatt = d.LowBatt,
                    BeamHealth = d.Role == DeviceRole.Goal ? BeamHealth(d.LastStatus) : null,
                    LastSeenAt = d.LastSeenAt,
                })
                .ToList(),
        };
    }

    /// <summary>The status's <c>beam.health</c>; <c>blocked</c> / <c>ok</c> from <c>beam_blocked</c> on firmware without it.</summary>
    private static string? BeamHealth(string? lastStatus)
    {
        if (lastStatus is null) return null;
        try
        {
            using var json = JsonDocument.Parse(lastStatus);
            var root = json.RootElement;
            if (root.TryGetProperty("beam", out var beam) && beam.ValueKind == JsonValueKind.Object &&
                beam.TryGetProperty("health", out var health) && health.ValueKind == JsonValueKind.String)
            {
                return health.GetString();
            }

            return root.TryGetProperty("beam_blocked", out var blocked) && blocked.ValueKind is JsonValueKind.True or JsonValueKind.False
                ? blocked.GetBoolean() ? "blocked" : "ok"
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private async Task<PreviousTableMatchResponse?> PreviousMatchAsync(Guid tableId)
    {
        var previous = await dbContext.TableMatches.AsNoTracking()
            .Where(m => m.TableId == tableId && m.Status == TableMatchStatus.Submitted && m.MatchId != null)
            .OrderByDescending(m => m.EndedAt)
            .Select(m => new { m.Id, MatchId = m.MatchId!.Value })
            .FirstOrDefaultAsync();
        if (previous is null)
        {
            return null;
        }

        // Submitted table matches always store end A as team index 0.
        var teams = await dbContext.MatchTeams.AsNoTracking()
            .Where(t => t.MatchId == previous.MatchId)
            .Include(t => t.Players)
            .ThenInclude(p => p.LeaguePlayer)
            .ThenInclude(lp => lp.OrganizationMembership)
            .ThenInclude(om => om.User)
            .ToListAsync();
        if (teams.Count != 2)
        {
            return null;
        }

        List<TablePlayerResponse> Players(int index) => teams.Single(t => t.Index == index).Players
            .OrderBy(p => p.Index)
            .Select(p => new TablePlayerResponse
            {
                LeaguePlayerId = p.LeaguePlayerId,
                DisplayName = p.LeaguePlayer.OrganizationMembership.GetDisplayName(),
                Username = p.LeaguePlayer.OrganizationMembership.GetUsername(),
            }).ToList();

        return new PreviousTableMatchResponse
        {
            Id = previous.Id,
            MatchId = previous.MatchId,
            LeagueId = teams[0].LeagueId,
            PlayersA = Players(0),
            PlayersB = Players(1),
        };
    }

    public async Task<List<TableMatchResponse>> GetClaimableMatchesAsync(Guid orgId, Guid? tableId)
    {
        var since = DateTimeOffset.UtcNow - ClaimWindow;
        var matches = await dbContext.TableMatches.AsNoTracking()
            .Include(m => m.Table)
            .Include(m => m.Goals.Where(g => g.UndoneAt == null))
            .Where(m => m.OrganizationId == orgId && m.Status == TableMatchStatus.Finished && m.EndedAt >= since)
            .Where(m => m.ActiveMatchId == null)
            .Where(m => tableId == null || m.TableId == tableId)
            .OrderByDescending(m => m.EndedAt)
            .ToListAsync();

        var result = new List<TableMatchResponse>();
        foreach (var match in matches)
        {
            result.Add(await MapTableMatchAsync(match.Table, match));
        }

        return result;
    }

    public async Task<MatchResponse> ClaimMatchAsync(Guid orgId, Guid leagueId, Guid tableMatchId,
        ClaimTableMatchRequest request)
    {
        var tableId = await dbContext.TableMatches
                          .Where(m => m.Id == tableMatchId && m.OrganizationId == orgId)
                          .Select(m => (Guid?)m.TableId)
                          .FirstOrDefaultAsync()
                      ?? throw new NotFoundException("Table match not found");

        return await MutateTableAsync(tableId, async table =>
        {
            if (table.LeagueId != leagueId)
            {
                throw new InvalidArgumentException("This table's games are rated in another league");
            }

            var now = DateTimeOffset.UtcNow;
            var match = await dbContext.TableMatches.Include(m => m.ActiveMatch)
                .FirstAsync(m => m.Id == tableMatchId);

            if (match.Status is not (TableMatchStatus.Live or TableMatchStatus.Finished))
            {
                throw new ConflictException($"This match can't be claimed: it is {match.Status}");
            }

            if (match.EndedAt < now - ClaimWindow)
            {
                throw new InvalidArgumentException("This match is too old to claim");
            }

            match.EndedAt ??= now;
            match.Status = TableMatchStatus.Finished;

            if (match.ActiveMatch is { } activeMatch)
            {
                if (activeMatch.LeagueId != leagueId)
                {
                    throw new InvalidArgumentException("The match is linked to an active match in another league");
                }

                return (await SubmitLinkedAsync(match, null, now), true);
            }

            var teams = request.Teams ?? throw new InvalidArgumentException("Teams are required");
            if (teams.Count != 2 || teams.Select(t => t.End).Distinct().Count() != 2)
            {
                throw new InvalidArgumentException("Give exactly one team for end A and one for end B");
            }

            var submitRequest = new SubmitMatchRequest
            {
                Teams = teams.OrderBy(t => t.End).Select(t => new SubmitMatchTeamRequest
                {
                    Players = t.Players,
                    Score = t.End == TableEnd.A ? match.ScoreA : match.ScoreB,
                }).ToList(),
            };
            var response = await matchesService.SubmitMatchAsync(orgId, leagueId, submitRequest, MatchSource.Table);
            match.Status = TableMatchStatus.Submitted;
            match.MatchId = response.Id;
            return (response, true);
        });
    }

    public async Task<LiveTableResponse> LinkActiveMatchAsync(Guid orgId, Guid leagueId, Guid activeMatchId,
        LinkTableRequest request)
    {
        var activeMatchExists = await dbContext.V3ActiveMatches
            .AnyAsync(am => am.Id == activeMatchId && am.LeagueId == leagueId && am.OrganizationId == orgId);
        if (!activeMatchExists)
        {
            throw new NotFoundException("Active match not found");
        }

        var tableLeague = await dbContext.FoosballTables
                              .Where(t => t.Id == request.TableId && t.OrganizationId == orgId)
                              .Select(t => (Guid?)t.LeagueId).FirstOrDefaultAsync()
                          ?? throw new NotFoundException("Table not found");
        if (tableLeague != leagueId)
        {
            throw new InvalidArgumentException("This table plays in another league");
        }

        await MutateTableAsync(request.TableId, async table =>
        {
            var linkedElsewhere = await dbContext.TableMatches.AnyAsync(m =>
                m.ActiveMatchId == activeMatchId &&
                m.Status == TableMatchStatus.Live &&
                m.TableId != table.Id);
            if (linkedElsewhere)
            {
                throw new ConflictException("This active match is already being played on another table");
            }

            var now = DateTimeOffset.UtcNow;
            var match = await CurrentMatchAsync(table.Id);
            if (match is { Status: TableMatchStatus.Live })
            {
                if (match.ActiveMatchId is not null && match.ActiveMatchId != activeMatchId)
                {
                    throw new ConflictException("The table is already playing another active match");
                }
            }
            else
            {
                match = StartMatch(table, now);
            }

            match.ActiveMatchId = activeMatchId;
            match.ActiveMatchTeamIndexAtEndA = request.TeamIndexAtEndA;
            match.TeamsMode = null;
            match.LastActivityAt = now;
            await SetRosterAsync(table, await dbContext.PendingMatchTeamPlayers
                .Where(p => p.PendingMatchTeam.PendingMatchId == dbContext.V3ActiveMatches
                    .Where(am => am.Id == activeMatchId).Select(am => am.PendingMatchId).FirstOrDefault())
                .OrderBy(p => p.PendingMatchTeam.Index).ThenBy(p => p.Index)
                .Select(p => p.LeaguePlayerId)
                .ToListAsync());
            return (0, true);
        });

        return await GetLiveTableAsync(orgId, request.TableId);
    }

    public async Task<ShortLinkResponse> ResolveShortLinkAsync(string code)
    {
        // Random codes are uppercase Crockford (look-alikes mapped); a table's custom code is lowercase.
        var custom = code.Trim().ToLowerInvariant();
        code = ShortCode.Normalize(code);
        var card = await dbContext.CardLinkRequests.AsNoTracking().FirstOrDefaultAsync(r => r.ShortCode == code);
        var match = card is not null
            ? null
            : await dbContext.TableMatches.AsNoTracking().Include(m => m.Table)
                .FirstOrDefaultAsync(m => m.ShortCode == code);
        var table = match?.Table ?? await dbContext.FoosballTables.AsNoTracking()
                        .FirstOrDefaultAsync(t => card != null
                            ? t.Id == card.TableId
                            : t.ShortCode == code || t.ShortCode == custom)
                    ?? throw new NotFoundException("Link not found");

        // Don't reveal other organizations' tables.
        if (await organizationService.GetMembershipForCurrentUserAsync(table.OrganizationId) is not
            { Status: MembershipStatus.Active })
        {
            throw new NotFoundException("Link not found");
        }

        if (card?.ExpiresAt < DateTimeOffset.UtcNow)
        {
            throw new GoneException("This card link has expired. Scan the card again.");
        }

        // What the link opens follows the game: a table code means the table's game right now.
        var now = DateTimeOffset.UtcNow;
        bool Claimable(TableMatch m) =>
            m is { Status: TableMatchStatus.Finished, ActiveMatchId: null } && m.EndedAt >= now - ClaimWindow;
        var target = match;
        var tableCode = card is null && match is null;
        if (tableCode)
        {
            // The latest game; when the board has moved on to the lobby, the latest one still to claim.
            var current = await CurrentMatchAsync(table.Id, track: false);
            target = current is { Status: TableMatchStatus.Live or TableMatchStatus.Finished or TableMatchStatus.Submitted }
                ? current
                : await dbContext.TableMatches.AsNoTracking()
                    .Where(m => m.TableId == table.Id && m.Status == TableMatchStatus.Finished && m.ActiveMatchId == null &&
                                m.EndedAt >= now - ClaimWindow)
                    .OrderByDescending(m => m.EndedAt)
                    .FirstOrDefaultAsync();
        }

        var ratedMatchId = target is { Status: TableMatchStatus.Submitted, MatchId: { } rated } ? rated : (Guid?)null;
        var leagueId = ratedMatchId is { } ratedId
            ? await dbContext.Set<V3Match>().Where(m => m.Id == ratedId).Select(m => (Guid?)m.LeagueId).FirstOrDefaultAsync()
            : table.LeagueId;
        var league = await dbContext.Leagues.AsNoTracking()
                         .Where(l => l.OrganizationId == table.OrganizationId)
                         .OrderBy(l => l.Id != leagueId).ThenBy(l => l.Name)
                         .FirstOrDefaultAsync()
                     ?? throw new NotFoundException("The organization has no league");
        var orgSlug = await dbContext.Organizations.Where(o => o.Id == table.OrganizationId)
            .Select(o => o.Slug).FirstAsync();

        var claimable = target is not null && Claimable(target);
        // Right after the win, the sticker shows the result first (the live page has "Who played?").
        var justEnded = tableCode && target is { Status: TableMatchStatus.Finished or TableMatchStatus.Submitted } &&
                        target.EndedAt >= now - JustEndedLive;
        var path = card is not null ? $"/{orgSlug}/cards?code={code}"
            : justEnded ? $"/{orgSlug}/{league.Slug}/tables/{table.Id}"
            // Rated: the match page (with its goals).
            : ratedMatchId is { } id ? $"/{orgSlug}/{league.Slug}/match/{id}"
            // Being played, or waiting for its players to confirm: the live table page.
            : target is { Status: TableMatchStatus.Live } or { Status: TableMatchStatus.Finished, ActiveMatchId: not null }
                ? $"/{orgSlug}/{league.Slug}/tables/{table.Id}"
            // Who played? The submit page, prefilled.
            : claimable ? $"/{orgSlug}/{league.Slug}/submit?table={table.Id}&match={target!.Id}"
            : $"/{orgSlug}/{league.Slug}/submit?table={table.Id}";
        match = claimable ? target : null;

        return new ShortLinkResponse
        {
            Kind = card is null ? ShortLinkKind.Table : ShortLinkKind.Card,
            Path = path,
            OrganizationId = table.OrganizationId,
            OrgSlug = orgSlug,
            LeagueId = league.Id,
            LeagueSlug = league.Slug,
            TableId = table.Id,
            TableMatchId = match?.Id,
            MatchId = ratedMatchId,
            TableName = table.Name,
            CardLinkExpiresAt = card?.ExpiresAt,
        };
    }

    public async Task<int> CloseStaleMatchesAsync()
    {
        await ClearStaleRostersAsync();

        var cutoff = DateTimeOffset.UtcNow - LiveMatchTimeout;
        var tableIds = await dbContext.TableMatches
            .Where(m => m.Status == TableMatchStatus.Live && m.LastActivityAt < cutoff)
            .Select(m => m.TableId)
            .Distinct()
            .ToListAsync();

        var closed = 0;
        foreach (var tableId in tableIds)
        {
            closed += await MutateTableAsync(tableId, async _ =>
            {
                var match = await CurrentMatchAsync(tableId);
                if (match is not { Status: TableMatchStatus.Live } || match.LastActivityAt >= cutoff)
                {
                    return (0, false);
                }

                await CloseIdleAsync(match, DateTimeOffset.UtcNow);
                return (1, true);
            });
        }

        return closed;
    }

    public async Task<int> SubmitDueMatchesAsync()
    {
        var now = DateTimeOffset.UtcNow;
        var due = await dbContext.TableMatches.AsNoTracking()
            .Where(m => m.AutoSubmitAt <= now && m.Status == TableMatchStatus.Finished)
            .Select(m => new { m.Id, m.TableId })
            .ToListAsync();

        var submitted = 0;
        foreach (var candidate in due)
        {
            try
            {
                // Re-checked under the table lock: another replica (or an undo) may have got there first.
                submitted += await MutateTableAsync(candidate.TableId, async _ =>
                {
                    var match = await dbContext.TableMatches.FirstAsync(m => m.Id == candidate.Id);
                    if (match is not { Status: TableMatchStatus.Finished, AutoSubmitAt: { } at, ActiveMatchId: { } activeMatchId } ||
                        at > now)
                    {
                        return (0, false);
                    }

                    await SubmitLinkedAsync(match, await RosterMembershipIdAsync(activeMatchId), now);
                    return (1, true);
                });
            }
            catch (Exception ex)
            {
                // An invalid result (e.g. a late queued goal changed the score) is left to the players to confirm
                // or claim; anything else (e.g. the MMR API is down) is retried in a minute, not every second.
                var invalid = ex is IHttpException;
                logger.LogWarning(ex, "Auto-submit of table match {TableMatchId} failed; {Next}", candidate.Id,
                    invalid ? "left to the players" : "retrying in 1 min");
                dbContext.ChangeTracker.Clear();
                DateTimeOffset? retryAt = invalid ? null : now + TimeSpan.FromMinutes(1);
                await dbContext.TableMatches.Where(m => m.Id == candidate.Id && m.AutoSubmitAt != null)
                    .ExecuteUpdateAsync(s => s.SetProperty(m => m.AutoSubmitAt, retryAt));
            }
        }

        return submitted;
    }

    /// <summary>
    /// Deletes expired card links (an unknown card is kept only while its link works) and lobbies nobody has
    /// joined for <see cref="RosterIdleTimeout"/>, so their boards redraw.
    /// </summary>
    private async Task ClearStaleRostersAsync()
    {
        var now = DateTimeOffset.UtcNow;
        var expiredLinks = await dbContext.CardLinkRequests.Where(r => r.ExpiresAt < now).Select(r => r.TableId)
            .ToListAsync();
        var idleRosters = await dbContext.TableRosterEntries.GroupBy(e => e.TableId)
            .Where(g => g.Max(e => e.CreatedAt) < now - RosterIdleTimeout)
            .Select(g => g.Key)
            .ToListAsync();

        foreach (var tableId in expiredLinks.Union(idleRosters))
        {
            await MutateTableAsync(tableId, async _ =>
            {
                var changed = await dbContext.CardLinkRequests
                    .Where(r => r.TableId == tableId && r.ExpiresAt < now).ExecuteDeleteAsync() > 0;
                // Not while a game is on: its players keep their colours.
                if (idleRosters.Contains(tableId) &&
                    await CurrentMatchAsync(tableId, track: false) is not { Status: TableMatchStatus.Live })
                {
                    changed |= await dbContext.TableRosterEntries.Where(e => e.TableId == tableId).ExecuteDeleteAsync() > 0;
                }

                return (0, changed);
            });
        }
    }

    // ---- Helpers ----

    /// <summary>
    /// Runs <paramref name="action"/> with the table row locked. Every change to a table's matches goes
    /// through here, so goals, actions and claims on one table are serialised.
    /// </summary>
    private async Task<T> MutateTableAsync<T>(Guid tableId, Func<FoosballTable, Task<(T Result, bool Changed)>> action)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var table = await dbContext.FoosballTables
                        .FromSqlInterpolated($"SELECT * FROM foosball_tables WHERE id = {tableId} FOR UPDATE")
                        .AsTracking()
                        .FirstOrDefaultAsync()
                    ?? throw new NotFoundException("Table not found");

        var (result, changed) = await action(table);
        if (changed)
        {
            table.StateVersion++;
        }

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        if (changed)
        {
            notifier.Notify(tableId);
        }

        return result;
    }

    private async Task<TableMatch?> CurrentMatchAsync(Guid tableId, bool track = true)
    {
        var query = dbContext.TableMatches
            .Include(m => m.Goals.Where(g => g.UndoneAt == null))
            .Where(m => m.TableId == tableId)
            .OrderByDescending(m => m.StartedAt)
            .ThenByDescending(m => m.CreatedAt);
        return await (track ? query : query.AsNoTracking()).FirstOrDefaultAsync();
    }

    private TableMatch StartMatch(FoosballTable table, DateTimeOffset startedAt)
    {
        var match = new TableMatch
        {
            OrganizationId = table.OrganizationId,
            TableId = table.Id,
            Status = TableMatchStatus.Live,
            StartedAt = startedAt,
            LastActivityAt = DateTimeOffset.UtcNow,
        };
        dbContext.TableMatches.Add(match);
        return match;
    }

    private async Task CloseIdleAsync(TableMatch match, DateTimeOffset now)
    {
        match.Status = match.ScoreA + match.ScoreB > 0 ? TableMatchStatus.Finished : TableMatchStatus.Discarded;
        match.EndedAt = now;
        if (match.Status == TableMatchStatus.Discarded)
        {
            await DropOwnedActiveMatchAsync(match);
        }
    }

    private async Task<int?> WinningScoreAsync(FoosballTable table, TableMatch match)
    {
        var leagueId = await LeagueIdAsync(table, match);
        return leagueId is null
            ? null
            : await dbContext.Leagues.Where(l => l.Id == leagueId).Select(l => l.WinningScore).FirstOrDefaultAsync();
    }

    private async Task<Guid?> LeagueIdAsync(FoosballTable table, TableMatch match) =>
        match.ActiveMatchId is { } activeMatchId
            ? await dbContext.V3ActiveMatches.Where(am => am.Id == activeMatchId)
                .Select(am => (Guid?)am.LeagueId).FirstOrDefaultAsync()
            : table.LeagueId;

    private static bool IsCompleteResult(int scoreA, int scoreB, int? winningScore) =>
        scoreA != scoreB && (winningScore is not { } target ||
                             (Math.Max(scoreA, scoreB) == target && Math.Min(scoreA, scoreB) < target));

    private async Task<MatchResponse> SubmitLinkedAsync(TableMatch match, Guid? submittedByMembershipId,
        DateTimeOffset now)
    {
        var activeMatchId = match.ActiveMatchId!.Value;
        var leagueId = await dbContext.V3ActiveMatches.Where(am => am.Id == activeMatchId)
            .Select(am => am.LeagueId).FirstAsync();
        var indexA = match.ActiveMatchTeamIndexAtEndA;

        var response = await matchMakingService.SubmitActiveMatchResultAsync(match.OrganizationId, leagueId,
            activeMatchId,
            new SubmitActiveMatchResultRequest
            {
                Teams =
                [
                    new ActiveMatchTeamScoreRequest { TeamIndex = indexA, Score = match.ScoreA },
                    new ActiveMatchTeamScoreRequest { TeamIndex = 1 - indexA, Score = match.ScoreB },
                ],
            },
            submittedByMembershipId, MatchSource.Table);

        logger.LogInformation("Table match {TableMatchId} submitted as match {MatchId}", match.Id, response.Id);
        match.Status = TableMatchStatus.Submitted;
        match.MatchId = response.Id;
        match.EndedAt ??= now;
        match.AutoSubmitAt = null;
        return response;
    }

    // A scoreboard has no user; record the match as created by one of its players.
    private Task<Guid> RosterMembershipIdAsync(Guid activeMatchId) =>
        dbContext.V3ActiveMatches.Where(am => am.Id == activeMatchId)
            .SelectMany(am => am.PendingMatch.Teams.OrderBy(t => t.Index))
            .SelectMany(t => t.Players.OrderBy(p => p.Index))
            .Select(p => p.LeaguePlayer.OrganizationMembershipId)
            .FirstAsync();

    private async Task<Dictionary<TableEnd, List<TablePlayerResponse>>> LoadRosterAsync(TableMatch match)
    {
        var roster = new Dictionary<TableEnd, List<TablePlayerResponse>> { [TableEnd.A] = [], [TableEnd.B] = [] };
        List<(TableEnd End, List<LeaguePlayer> Players)> teams;
        if (match.ActiveMatchId is { } activeMatchId)
        {
            teams = (await dbContext.PendingMatchTeams.AsNoTracking()
                    .Where(t => t.PendingMatch.Id == dbContext.V3ActiveMatches
                        .Where(am => am.Id == activeMatchId).Select(am => am.PendingMatchId).FirstOrDefault())
                    .Include(t => t.Players).ThenInclude(p => p.LeaguePlayer)
                    .ThenInclude(lp => lp.OrganizationMembership).ThenInclude(om => om.User)
                    .ToListAsync())
                .Select(t => (t.Index == match.ActiveMatchTeamIndexAtEndA ? TableEnd.A : TableEnd.B,
                    t.Players.OrderBy(p => p.Index).Select(p => p.LeaguePlayer).ToList()))
                .ToList();
        }
        else if (match.MatchId is { } matchId)
        {
            // Submitted table matches store end A as team index 0.
            teams = (await dbContext.MatchTeams.AsNoTracking().Where(t => t.MatchId == matchId)
                    .Include(t => t.Players).ThenInclude(p => p.LeaguePlayer)
                    .ThenInclude(lp => lp.OrganizationMembership).ThenInclude(om => om.User)
                    .ToListAsync())
                .Select(t => (t.Index == 0 ? TableEnd.A : TableEnd.B,
                    t.Players.OrderBy(p => p.Index).Select(p => p.LeaguePlayer).ToList()))
                .ToList();
        }
        else
        {
            return roster;
        }

        // Scanned-in players keep their LED colour in the game.
        var colors = await dbContext.TableRosterEntries.AsNoTracking().Where(e => e.TableId == match.TableId)
            .ToDictionaryAsync(e => e.LeaguePlayerId, e => e.Color);
        foreach (var (end, players) in teams)
        {
            roster[end] = players
                .Select(p => ToTablePlayer(p, colors.TryGetValue(p.Id, out var c) ? c : null))
                .ToList();
        }

        return roster;
    }

    private async Task<ScoreboardMatch> MapScoreboardMatchAsync(FoosballTable table, TableMatch match, TableEnd boardEnd)
    {
        // A reader faces the board, i.e. looks towards its end. Players keep their own goal on their left
        // hand (goalie rod), so the team defending the board's end stands on the reader's left.
        var leftEnd = boardEnd;
        var rightEnd = boardEnd == TableEnd.A ? TableEnd.B : TableEnd.A;
        string SideOf(TableEnd end) => end == rightEnd ? "right" : "left";

        var roster = await LoadRosterAsync(match);
        var players = roster.Values.SelectMany(p => p).ToDictionary(p => p.LeaguePlayerId);
        var now = DateTimeOffset.UtcNow;
        var lastGoal = match.Goals.Where(g => g.UndoneAt == null).MaxBy(g => g.ReceivedAt);
        var finished = match.Status is TableMatchStatus.Finished or TableMatchStatus.Submitted;

        ScoreboardTeam Team(TableEnd end) => new()
        {
            EndLabel = end == TableEnd.A ? table.EndLabelA : table.EndLabelB,
            Score = end == TableEnd.A ? match.ScoreA : match.ScoreB,
            Players = roster[end].Select(ToScoreboardPlayer).ToList(),
        };

        return new ScoreboardMatch
        {
            Id = match.Id.ToString(),
            Status = finished ? "finished" : "live",
            StartedAt = match.StartedAt,
            EndedAt = match.EndedAt,
            Winner = finished && match.ScoreA != match.ScoreB
                ? SideOf(match.ScoreA > match.ScoreB ? TableEnd.A : TableEnd.B)
                : null,
            CanUndo = match.Status is TableMatchStatus.Live or TableMatchStatus.Finished && lastGoal is not null,
            CanSwap = match is { Status: TableMatchStatus.Live, ActiveMatchId: not null } &&
                      match.ScoreA + match.ScoreB == 0 && roster[TableEnd.A].Count > 0 && roster[TableEnd.B].Count > 0,
            TeamsMode = match.TeamsMode,
            Left = Team(leftEnd),
            Right = Team(rightEnd),
            SubmitInS = match is { Status: TableMatchStatus.Finished, AutoSubmitAt: { } submitAt }
                ? (int)Math.Ceiling(Math.Max(0, (submitAt - now).TotalSeconds))
                : null,
            Summary = finished ? await SummaryAsync(table, match) : null,
            LastGoal = lastGoal is null
                ? null
                : new ScoreboardGoal
                {
                    Id = lastGoal.Id.ToString(),
                    Side = SideOf(lastGoal.ScoringEnd!.Value),
                    Scorer = lastGoal.ScorerLeaguePlayerId is { } scorerId && players.TryGetValue(scorerId, out var scorer)
                        ? ToScoreboardPlayer(scorer)
                        : null,
                    OwnGoal = lastGoal.ScorerLeaguePlayerId is { } id &&
                              !roster[lastGoal.ScoringEnd!.Value].Any(p => p.LeaguePlayerId == id),
                    AgeS = (int)Math.Max(0, (now - GoalTime(lastGoal)).TotalSeconds),
                    OccurredAt = GoalTime(lastGoal),
                },
        };
    }

    private async Task<ScoreboardSummary> SummaryAsync(FoosballTable table, TableMatch match)
    {
        var counted = TableMatchStats.Counted(match.Goals);
        var teams = await TeamsAsync(match);
        var mvp = await TableMatchStats.MvpAsync(teams, StatsGoals(counted), await WinningScoreAsync(table, match),
            () => PreMatchRatingsAsync(match, teams.SelectMany(t => t).ToList()));
        string? mvpName = null;
        if (mvp is { } mvpId)
        {
            var membership = await dbContext.OrganizationMemberships.AsNoTracking().Include(m => m.User)
                .FirstAsync(m => dbContext.LeaguePlayers.Any(lp => lp.Id == mvpId && lp.OrganizationMembershipId == m.Id));
            mvpName = Truncate(membership.GetDisplayName() ?? membership.GetUsername() ?? "Player", 24);
        }

        return new ScoreboardSummary { DurationS = TableMatchStats.SpanSeconds(counted), MvpName = mvpName };
    }

    private static List<TableMatchStats.Goal> StatsGoals(IEnumerable<TableGoal> counted) =>
        counted.Select(g => new TableMatchStats.Goal(g.ScoringEnd == TableEnd.A ? 0 : 1, g.ScorerLeaguePlayerId)).ToList();

    /// <summary>The match's players by team index (0 = end A): the rated match's once submitted, else the linked roster's.</summary>
    private async Task<List<IReadOnlyList<Guid>>> TeamsAsync(TableMatch match)
    {
        var roster = await LoadRosterAsync(match);
        return [roster[TableEnd.A].Select(p => p.LeaguePlayerId).ToList(), roster[TableEnd.B].Select(p => p.LeaguePlayerId).ToList()];
    }

    /// <summary>
    /// Ratings before the match (METRICS A2): the latest earlier rating history once rated, else the current
    /// rating; the default (25, 25/3) for a first match.
    /// </summary>
    private async Task<Dictionary<Guid, (double Mu, double Sigma)>> PreMatchRatingsAsync(TableMatch match, List<Guid> players)
    {
        var ratings = players.Distinct().ToDictionary(p => p, _ => (Mu: 25.0, Sigma: 25.0 / 3));
        if (match.MatchId is { } matchId)
        {
            // Rating order is (PlayedAt, RecordedAt), as in V3MatchesService.
            var rated = await dbContext.Set<V3Match>().Where(m => m.Id == matchId)
                .Select(m => new { m.PlayedAt, m.RecordedAt }).FirstAsync();
            var history = await dbContext.RatingHistories.AsNoTracking()
                .Where(h => players.Contains(h.LeaguePlayerId) &&
                            (h.Match.PlayedAt < rated.PlayedAt ||
                             h.Match.PlayedAt == rated.PlayedAt && h.Match.RecordedAt < rated.RecordedAt))
                .Select(h => new { h.LeaguePlayerId, h.Mu, h.Sigma, h.Match.PlayedAt, h.Match.RecordedAt })
                .ToListAsync();
            foreach (var h in history.GroupBy(h => h.LeaguePlayerId)
                         .Select(g => g.MaxBy(h => (h.PlayedAt, h.RecordedAt))!))
            {
                ratings[h.LeaguePlayerId] = ((double)h.Mu, (double)h.Sigma);
            }
        }
        else
        {
            foreach (var lp in await dbContext.LeaguePlayers.AsNoTracking().Where(lp => players.Contains(lp.Id)).ToListAsync())
            {
                ratings[lp.Id] = ((double)lp.Mu, (double)lp.Sigma);
            }
        }

        return ratings;
    }

    private static ScoreboardPlayer ToScoreboardPlayer(TablePlayerResponse player)
    {
        return new ScoreboardPlayer
        {
            Id = player.LeaguePlayerId.ToString(),
            Name = Truncate(player.DisplayName ?? player.Username ?? "Player", 24),
            Color = player.Color,
        };
    }

    private static string Truncate(string value, int length) => value.Length > length ? value[..length] : value;

    private static DateTimeOffset GoalTime(TableGoal goal) => goal.OccurredAt ?? goal.ReceivedAt;

    private async Task<TableMatchResponse> MapTableMatchAsync(FoosballTable table, TableMatch match)
    {
        var roster = await LoadRosterAsync(match);
        var lastGoal = match.Goals.Where(g => g.UndoneAt == null).MaxBy(g => g.ReceivedAt);

        return new TableMatchResponse
        {
            Id = match.Id,
            TableId = match.TableId,
            Status = match.Status,
            StartedAt = match.StartedAt,
            EndedAt = match.EndedAt,
            ScoreA = match.ScoreA,
            ScoreB = match.ScoreB,
            ActiveMatchId = match.ActiveMatchId,
            LeagueId = await LeagueIdAsync(table, match),
            PlayersA = roster[TableEnd.A],
            PlayersB = roster[TableEnd.B],
            LastGoal = lastGoal is null
                ? null
                : new TableGoalResponse
                {
                    Id = lastGoal.Id,
                    End = lastGoal.ScoringEnd!.Value,
                    ScorerLeaguePlayerId = lastGoal.ScorerLeaguePlayerId,
                    OccurredAt = GoalTime(lastGoal),
                },
            MatchId = match.MatchId,
            ClaimableUntil = match.Status == TableMatchStatus.Finished ? match.EndedAt + ClaimWindow : null,
            AutoSubmitAt = match.Status == TableMatchStatus.Finished ? match.AutoSubmitAt : null,
        };
    }
}

/// <summary>
/// The scoreboard LEDs' six player colours (ux: SCOREBOARD-UI §Scan-in), as palette indexes; the app shows
/// the same hues. Each member has a preferred colour; a clash in one roster takes the next free one.
/// </summary>
public static class PlayerColors
{
    /// <summary>Red, yellow, green, cyan, blue, magenta.</summary>
    public static readonly string[] Hex = ["#e53935", "#fdd835", "#43a047", "#00acc1", "#1e88e5", "#d81b60"];

    /// <summary>Stable per member (unlike <c>GetHashCode</c>, across processes and .NET versions).</summary>
    public static int Preferred(Guid membershipId) => SHA256.HashData(membershipId.ToByteArray())[0] % Hex.Length;

    public static int Assign(Guid membershipId, IEnumerable<int> taken)
    {
        var used = taken.ToHashSet();
        var preferred = Preferred(membershipId);
        return Enumerable.Range(0, Hex.Length).Select(i => (preferred + i) % Hex.Length)
            .FirstOrDefault(c => !used.Contains(c), preferred);
    }
}
