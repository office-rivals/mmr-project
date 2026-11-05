using System.Linq.Expressions;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Extensions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface IGameInviteService
{
    Task<CurrentGameInviteResponse> GetCurrentInviteAsync(Guid orgId, Guid leagueId);
    Task<GameInviteResponse> CreateInviteAsync(Guid orgId, Guid leagueId);
    Task<GameInviteResponse> GetInviteAsync(Guid orgId, Guid leagueId, Guid inviteId);
    Task<GameInviteLinkResponse> GetInviteByShareCodeAsync(string shareCode);
    Task<GameInviteResponse> JoinByShareCodeAsync(string shareCode);
    Task<GameInviteResponse> AddPlayersAsync(Guid orgId, Guid leagueId, Guid inviteId, IReadOnlyCollection<Guid> leaguePlayerIds);
    Task<GameInviteResponse> RemoveParticipantAsync(Guid orgId, Guid leagueId, Guid inviteId, Guid leaguePlayerId);
    Task<GameInviteResponse> LeaveAsync(Guid orgId, Guid leagueId, Guid inviteId, bool removeManagedPlayers);
    Task<GameInviteResponse> CancelAsync(Guid orgId, Guid leagueId, Guid inviteId);
    Task<GameInviteResponse> TakeControlAsync(Guid orgId, Guid leagueId, Guid inviteId);
    Task<GameInviteResponse> RespondAsync(Guid orgId, Guid leagueId, Guid inviteId, Guid roundId, Guid leaguePlayerId, bool accept);

    /// <summary>
    /// Commits any waiting expiry or acceptance deadline that has already passed in one league.
    /// Callers that check commitments (queue joins) run this first so decisions never act on a timed-out invite.
    /// </summary>
    Task<int> SettleLeagueAsync(Guid leagueId, CancellationToken cancellationToken = default);

    /// <summary>Settles every league with a due invite. Called by the background worker.</summary>
    Task<int> ReconcileDueInvitesAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Game invites own a roster independent of the matchmaking queue (ADR 0001).
/// Every mutation runs under the league's commitment lock, so the one-commitment
/// rule holds against concurrent queue joins, invite joins, pending-match creation and acceptances.
/// Timers are applied before any decision, in a transaction that commits on its own, so a
/// rejected request cannot roll back an expiry.
/// </summary>
public class GameInviteService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    ILogger<GameInviteService> logger) : IGameInviteService
{
    public static readonly TimeSpan WaitingLifetime = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan AcceptanceWindow = TimeSpan.FromSeconds(30);

    private const string ShareCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private const int ShareCodeLength = 12;

    public async Task<CurrentGameInviteResponse> GetCurrentInviteAsync(Guid orgId, Guid leagueId)
    {
        var leaguePlayer = await RequireLeaguePlayerAsync(orgId, leagueId);
        await SettleLeagueAsync(leagueId);

        var inviteId = await dbContext.GameInviteParticipants
            .Where(p => p.LeagueId == leagueId && p.LeaguePlayerId == leaguePlayer.Id)
            .Select(p => (Guid?)p.GameInviteId)
            .FirstOrDefaultAsync();

        if (inviteId is null)
        {
            return new CurrentGameInviteResponse { Invite = null };
        }

        return new CurrentGameInviteResponse { Invite = await MapInviteAsync(inviteId.Value) };
    }

    public async Task<GameInviteResponse> CreateInviteAsync(Guid orgId, Guid leagueId)
    {
        var leaguePlayer = await RequireLeaguePlayerAsync(orgId, leagueId);

        var inviteId = await MutateAsync(leagueId, async now =>
        {
            var commitment = await LeagueCommitmentLock.FindAsync(dbContext, leagueId, leaguePlayer.Id);
            if (commitment is not null)
            {
                throw new ConflictException(DescribeCommitment(commitment.Value, subject: null));
            }

            var invite = new GameInvite
            {
                OrganizationId = orgId,
                LeagueId = leagueId,
                CreatedByLeaguePlayerId = leaguePlayer.Id,
                ShareCode = await GenerateShareCodeAsync(),
                Status = GameInviteStatus.Waiting,
                ExpiresAt = now + WaitingLifetime,
            };
            dbContext.GameInvites.Add(invite);
            // The creator occupies a spot and manages it.
            dbContext.GameInviteParticipants.Add(NewParticipant(invite, leaguePlayer.Id, leaguePlayer.Id, now));
            return invite.Id;
        });

        return await MapInviteAsync(inviteId);
    }

    public async Task<GameInviteResponse> GetInviteAsync(Guid orgId, Guid leagueId, Guid inviteId)
    {
        await RequireLeaguePlayerAsync(orgId, leagueId);
        await RequireInviteInLeagueAsync(leagueId, inviteId);
        await SettleLeagueAsync(leagueId);
        return await MapInviteAsync(inviteId);
    }

    public async Task<GameInviteLinkResponse> GetInviteByShareCodeAsync(string shareCode)
    {
        var invite = await FindByShareCodeAsync(shareCode);
        await SettleLeagueAsync(invite.LeagueId);

        var league = await dbContext.Leagues
            .AsNoTracking()
            .Include(l => l.Organization)
            .FirstAsync(l => l.Id == invite.LeagueId);

        var (eligibility, _) = await ResolveEligibilityAsync(league.OrganizationId, league.Id);

        return new GameInviteLinkResponse
        {
            OrganizationId = league.OrganizationId,
            OrganizationSlug = league.Organization.Slug,
            OrganizationName = league.Organization.Name,
            LeagueId = league.Id,
            LeagueSlug = league.Slug,
            LeagueName = league.Name,
            Eligibility = eligibility,
            // The roster is shared only with signed-in members of both the organization and the league.
            Invite = eligibility == GameInviteEligibility.Eligible
                ? await MapInviteAsync(invite.Id)
                : null,
        };
    }

    public async Task<GameInviteResponse> JoinByShareCodeAsync(string shareCode)
    {
        var target = await FindByShareCodeAsync(shareCode);
        var leaguePlayer = await RequireEligibleLeaguePlayerAsync(target.OrganizationId, target.LeagueId);

        var inviteId = await MutateAsync(target.LeagueId, async now =>
        {
            var locked = await RequireLockedInviteAsync(target.LeagueId, target.Id);
            RejectIfTimedOut(locked, now);

            // Joining again is harmless: the spot is already yours.
            if (locked.Participants.Any(p => p.LeaguePlayerId == leaguePlayer.Id))
            {
                return locked.Invite.Id;
            }

            if (locked.Invite.Status != GameInviteStatus.Waiting)
            {
                throw new ConflictException("This game invite is no longer accepting players.");
            }

            var capacity = await GetCapacityAsync(target.LeagueId);
            if (locked.Participants.Count >= capacity)
            {
                throw new ConflictException("This game invite is full.");
            }

            var commitment = await LeagueCommitmentLock.FindAsync(dbContext, target.LeagueId, leaguePlayer.Id);
            if (commitment is not null)
            {
                throw new ConflictException(DescribeCommitment(commitment.Value, subject: null));
            }

            AddParticipant(locked, NewParticipant(locked.Invite, leaguePlayer.Id, leaguePlayer.Id, now));
            if (locked.Participants.Count == capacity)
            {
                StartAcceptance(locked, capacity, now);
            }

            return locked.Invite.Id;
        });

        return await MapInviteAsync(inviteId);
    }

    public async Task<GameInviteResponse> AddPlayersAsync(
        Guid orgId,
        Guid leagueId,
        Guid inviteId,
        IReadOnlyCollection<Guid> leaguePlayerIds)
    {
        var me = await RequireLeaguePlayerAsync(orgId, leagueId);
        var requested = leaguePlayerIds.Distinct().ToList();
        if (requested.Count == 0)
        {
            throw new InvalidArgumentException("Choose at least one player to add.");
        }

        var resultId = await MutateAsync(leagueId, async now =>
        {
            var locked = await RequireLockedInviteAsync(leagueId, inviteId);
            RejectIfTimedOut(locked, now);

            RequireParticipant(locked, me.Id);

            // Retrying an add that already succeeded changes nothing.
            var alreadyMine = requested.All(id =>
                id == me.Id
                || locked.Participants.Any(p => p.LeaguePlayerId == id && p.RepresentativeLeaguePlayerId == me.Id));
            if (alreadyMine)
            {
                return locked.Invite.Id;
            }

            if (locked.Invite.Status != GameInviteStatus.Waiting)
            {
                throw new ConflictException("The roster is locked while players are accepting teams.");
            }

            var players = await dbContext.LeaguePlayers
                .AsNoTracking()
                .Include(lp => lp.OrganizationMembership)
                .ThenInclude(om => om.User)
                .Where(lp => lp.LeagueId == leagueId && requested.Contains(lp.Id))
                .ToListAsync();

            if (players.Count != requested.Count
                || players.Any(p => p.OrganizationMembership.Status != MembershipStatus.Active))
            {
                throw new InvalidArgumentException("One or more selected players are not active members of this league.");
            }

            var toAdd = new List<Guid>();
            foreach (var id in requested)
            {
                var existing = locked.Participants.FirstOrDefault(p => p.LeaguePlayerId == id);
                if (existing is not null)
                {
                    if (existing.RepresentativeLeaguePlayerId == me.Id) continue;
                    var name = players.First(p => p.Id == id).OrganizationMembership.GetDisplayName() ?? "A player";
                    throw new ConflictException($"{name} is already in this game invite.");
                }

                // Every added player follows the same commitment rule as joining.
                var commitment = await LeagueCommitmentLock.FindAsync(dbContext, leagueId, id);
                if (commitment is not null)
                {
                    var name = players.First(p => p.Id == id).OrganizationMembership.GetDisplayName() ?? "A player";
                    throw new ConflictException(DescribeCommitment(commitment.Value, subject: name));
                }

                toAdd.Add(id);
            }

            var capacity = await GetCapacityAsync(leagueId);
            var spotsLeft = Math.Max(0, capacity - locked.Participants.Count);
            if (toAdd.Count > spotsLeft)
            {
                // All or nothing: a partial add would split the group.
                throw new ConflictException(spotsLeft == 0
                    ? "This game invite is full."
                    : $"Only {spotsLeft} {(spotsLeft == 1 ? "spot" : "spots")} left in this game invite.");
            }

            foreach (var id in toAdd)
            {
                AddParticipant(locked, NewParticipant(locked.Invite, id, me.Id, now));
            }

            if (locked.Participants.Count == capacity)
            {
                StartAcceptance(locked, capacity, now);
            }

            return locked.Invite.Id;
        });

        return await MapInviteAsync(resultId);
    }

    public async Task<GameInviteResponse> RemoveParticipantAsync(Guid orgId, Guid leagueId, Guid inviteId, Guid leaguePlayerId)
    {
        var me = await RequireLeaguePlayerAsync(orgId, leagueId);
        if (leaguePlayerId == me.Id)
        {
            throw new InvalidArgumentException("Use leave to remove yourself from a game invite.");
        }

        var resultId = await MutateAsync(leagueId, async now =>
        {
            var locked = await RequireLockedInviteAsync(leagueId, inviteId);
            RejectIfTimedOut(locked, now);

            RequireParticipant(locked, me.Id);
            RequireWaiting(locked);

            var target = locked.Participants.FirstOrDefault(p => p.LeaguePlayerId == leaguePlayerId)
                ?? throw new NotFoundException("That player is not in this game invite.");

            if (target.LeaguePlayerId == locked.Invite.CreatedByLeaguePlayerId)
            {
                throw new InvalidArgumentException("The creator cannot be removed. Cancel the invite instead.");
            }

            var isCreator = me.Id == locked.Invite.CreatedByLeaguePlayerId;
            if (!isCreator && target.RepresentativeLeaguePlayerId != me.Id)
            {
                throw new ForbiddenException("You can only remove players you added.");
            }

            RemoveParticipants(locked, [target]);
            return locked.Invite.Id;
        });

        return await MapInviteAsync(resultId);
    }

    public async Task<GameInviteResponse> LeaveAsync(Guid orgId, Guid leagueId, Guid inviteId, bool removeManagedPlayers)
    {
        var me = await RequireLeaguePlayerAsync(orgId, leagueId);

        var resultId = await MutateAsync(leagueId, async now =>
        {
            var locked = await RequireLockedInviteAsync(leagueId, inviteId);
            RejectIfTimedOut(locked, now);

            RequireParticipant(locked, me.Id);

            // The creator leaving always cancels the invite.
            if (me.Id == locked.Invite.CreatedByLeaguePlayerId)
            {
                EndInvite(locked, GameInviteEndReason.CreatorLeft, now);
                return locked.Invite.Id;
            }

            RequireWaiting(locked);

            var leaving = locked.Participants.Where(p => p.LeaguePlayerId == me.Id).ToList();
            if (removeManagedPlayers)
            {
                leaving.AddRange(locked.Participants.Where(p =>
                    p.RepresentativeLeaguePlayerId == me.Id && p.LeaguePlayerId != me.Id));
            }

            // Players left behind by a representative who left alone pass to the creator.
            RemoveParticipants(locked, leaving);
            return locked.Invite.Id;
        });

        return await MapInviteAsync(resultId);
    }

    public async Task<GameInviteResponse> CancelAsync(Guid orgId, Guid leagueId, Guid inviteId)
    {
        var me = await RequireLeaguePlayerAsync(orgId, leagueId);

        var resultId = await MutateAsync(leagueId, async now =>
        {
            var locked = await RequireLockedInviteAsync(leagueId, inviteId);
            RejectIfTimedOut(locked, now);

            if (me.Id != locked.Invite.CreatedByLeaguePlayerId)
            {
                throw new ForbiddenException("Only the creator can cancel this game invite.");
            }

            if (locked.Invite.Status is GameInviteStatus.Started or GameInviteStatus.Ended)
            {
                throw new ConflictException("This game invite has already ended.");
            }

            EndInvite(locked, GameInviteEndReason.CreatorCancelled, now);
            return locked.Invite.Id;
        });

        return await MapInviteAsync(resultId);
    }

    public async Task<GameInviteResponse> TakeControlAsync(Guid orgId, Guid leagueId, Guid inviteId)
    {
        var me = await RequireLeaguePlayerAsync(orgId, leagueId);

        var resultId = await MutateAsync(leagueId, async now =>
        {
            var locked = await RequireLockedInviteAsync(leagueId, inviteId);
            RejectIfTimedOut(locked, now);

            var mine = RequireParticipant(locked, me.Id);

            // Acceptance state is untouched: taking control must not reset a response.
            // Whoever managed this spot before loses the ability to respond for it.
            mine.RepresentativeLeaguePlayerId = me.Id;
            return locked.Invite.Id;
        });

        return await MapInviteAsync(resultId);
    }

    public async Task<GameInviteResponse> RespondAsync(
        Guid orgId,
        Guid leagueId,
        Guid inviteId,
        Guid roundId,
        Guid leaguePlayerId,
        bool accept)
    {
        var me = await RequireLeaguePlayerAsync(orgId, leagueId);

        var resultId = await MutateAsync(leagueId, async now =>
        {
            var locked = await RequireLockedInviteAsync(leagueId, inviteId);
            RejectIfTimedOut(locked, now);

            // A response for an older shuffle must not accept a newer round.
            if (locked.Invite.Status != GameInviteStatus.AwaitingAcceptance || locked.Invite.CurrentRoundId != roundId)
            {
                throw new ConflictException("This acceptance step has already ended. Reload the invite.");
            }

            var target = locked.Participants.FirstOrDefault(p => p.LeaguePlayerId == leaguePlayerId)
                ?? throw new NotFoundException("That player is not in this game invite.");

            if (target.LeaguePlayerId != me.Id && target.RepresentativeLeaguePlayerId != me.Id)
            {
                throw new ForbiddenException("You can only respond for players you manage.");
            }

            var desired = accept ? AcceptanceStatus.Accepted : AcceptanceStatus.Declined;
            if (target.AcceptanceStatus == desired)
            {
                return locked.Invite.Id;
            }

            if (target.AcceptanceStatus != AcceptanceStatus.Pending)
            {
                throw new ConflictException("This player has already responded.");
            }

            if (!accept)
            {
                target.AcceptanceStatus = AcceptanceStatus.Declined;
                FailRound(locked, timedOut: false, now);
                return locked.Invite.Id;
            }

            target.AcceptanceStatus = AcceptanceStatus.Accepted;
            target.AcceptedAt = now;

            if (locked.Participants.All(p => p.AcceptanceStatus == AcceptanceStatus.Accepted))
            {
                await ValidateMatchRosterAsync(locked);
                StartMatch(locked, now);
            }

            return locked.Invite.Id;
        });

        return await MapInviteAsync(resultId);
    }

    public async Task<int> SettleLeagueAsync(Guid leagueId, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var dueInviteIds = await dbContext.GameInvites
            .AsNoTracking()
            .Where(i => i.LeagueId == leagueId)
            .Where(IsDueExpression(now))
            .Select(i => i.Id)
            .ToListAsync(cancellationToken);

        if (dueInviteIds.Count == 0)
        {
            return 0;
        }

        // Committed on its own: a later request that rejects itself must not undo the timeout.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await LeagueCommitmentLock.AcquireAsync(dbContext, leagueId, cancellationToken);

        var settleNow = DateTimeOffset.UtcNow;
        var settled = 0;
        foreach (var inviteId in dueInviteIds)
        {
            var locked = await LoadForUpdateAsync(leagueId, inviteId);
            if (locked is not null && IsDue(locked.Invite, settleNow))
            {
                Reconcile(locked, settleNow);
                settled++;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        dbContext.ChangeTracker.Clear();

        return settled;
    }

    public async Task<int> ReconcileDueInvitesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var leagueIds = await dbContext.GameInvites
            .AsNoTracking()
            .Where(IsDueExpression(now))
            .Select(i => i.LeagueId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var settled = 0;
        foreach (var leagueId in leagueIds)
        {
            settled += await SettleLeagueAsync(leagueId, cancellationToken);
        }

        if (settled > 0)
        {
            logger.LogInformation("Settled {Count} due game invites", settled);
        }

        return settled;
    }

    // ----- Lifecycle rules -------------------------------------------------

    /// <summary>A waiting invite past its expiry, or an acceptance step past its deadline.</summary>
    private static bool IsDue(GameInvite invite, DateTimeOffset now) =>
        (invite.Status == GameInviteStatus.Waiting && invite.ExpiresAt <= now)
        || (invite.Status == GameInviteStatus.AwaitingAcceptance && invite.AcceptanceExpiresAt <= now);

    private static Expression<Func<GameInvite, bool>> IsDueExpression(DateTimeOffset now) =>
        i => (i.Status == GameInviteStatus.Waiting && i.ExpiresAt <= now)
             || (i.Status == GameInviteStatus.AwaitingAcceptance && i.AcceptanceExpiresAt <= now);

    /// <summary>
    /// Applies a due transition. Only called from <see cref="SettleLeagueAsync"/>, under the league lock.
    /// </summary>
    private void Reconcile(LockedInvite locked, DateTimeOffset now)
    {
        var invite = locked.Invite;
        if (invite.Status == GameInviteStatus.Waiting && invite.ExpiresAt <= now)
        {
            EndInvite(locked, GameInviteEndReason.Expired, now);
            return;
        }

        if (invite.Status == GameInviteStatus.AwaitingAcceptance && invite.AcceptanceExpiresAt <= now)
        {
            FailRound(locked, timedOut: true, now);
        }
    }

    /// <summary>
    /// Ends an acceptance step that failed. Only accepted players keep their spots; declined,
    /// timed-out and still-pending players leave, and their represented players pass to the creator.
    /// The invite then reopens with its original link and expiry, or expires if that expiry has passed.
    /// </summary>
    private void FailRound(LockedInvite locked, bool timedOut, DateTimeOffset now)
    {
        var invite = locked.Invite;
        var creatorId = invite.CreatedByLeaguePlayerId;
        var creator = locked.Participants.FirstOrDefault(p => p.LeaguePlayerId == creatorId);

        if (creator is null || creator.AcceptanceStatus == AcceptanceStatus.Declined)
        {
            EndInvite(locked, GameInviteEndReason.CreatorDeclined, now);
            return;
        }

        if (timedOut && creator.AcceptanceStatus == AcceptanceStatus.Pending)
        {
            EndInvite(locked, GameInviteEndReason.CreatorTimedOut, now);
            return;
        }

        // The creator stays through a failed step, even while still pending.
        var removed = locked.Participants
            .Where(p => p.LeaguePlayerId != creatorId && p.AcceptanceStatus != AcceptanceStatus.Accepted)
            .ToList();
        RemoveParticipants(locked, removed);

        if (now >= invite.ExpiresAt)
        {
            EndInvite(locked, GameInviteEndReason.Expired, now);
            return;
        }

        invite.Status = GameInviteStatus.Waiting;
        invite.CurrentRoundId = null;
        invite.AcceptanceExpiresAt = null;
        foreach (var participant in locked.Participants)
        {
            // The next full roster gets new teams and a fresh acceptance step, so nobody carries a response over.
            participant.AcceptanceStatus = AcceptanceStatus.Pending;
            participant.AcceptedAt = null;
            participant.TeamIndex = null;
            participant.SlotIndex = null;
        }
    }

    /// <summary>
    /// Locks the roster and draws teams with the Play tab's Random shuffle. Each
    /// participant then has the same 30-second acceptance window.
    /// </summary>
    private static void StartAcceptance(LockedInvite locked, int capacity, DateTimeOffset now)
    {
        var teamSize = capacity / 2;
        var shuffled = GameInviteShuffle.FisherYates(
            locked.Participants.OrderBy(p => p.JoinedAt).ThenBy(p => p.LeaguePlayerId).ToList());

        for (var i = 0; i < shuffled.Count; i++)
        {
            var participant = shuffled[i];
            participant.TeamIndex = i / teamSize;
            participant.SlotIndex = i % teamSize;
            participant.AcceptanceStatus = AcceptanceStatus.Pending;
            participant.AcceptedAt = null;
        }

        locked.Invite.Status = GameInviteStatus.AwaitingAcceptance;
        locked.Invite.CurrentRoundId = Guid.NewGuid();
        locked.Invite.AcceptanceExpiresAt = now + AcceptanceWindow;
    }

    /// <summary>
    /// Do not create a match that the existing result path would reject after a
    /// league format or represented player's membership changed during readiness.
    /// The normal deadline/cancellation flow still releases these commitments.
    /// </summary>
    private async Task ValidateMatchRosterAsync(LockedInvite locked)
    {
        var invite = locked.Invite;
        var capacity = await GetCapacityAsync(invite.LeagueId);
        if (locked.Participants.Count != capacity)
        {
            throw new ConflictException("The league format changed. Cancel this invite and create a new one.");
        }

        var playerIds = locked.Participants.Select(p => p.LeaguePlayerId).ToList();
        var eligibleCount = await dbContext.LeaguePlayers.CountAsync(lp =>
            lp.OrganizationId == invite.OrganizationId && lp.LeagueId == invite.LeagueId
            && playerIds.Contains(lp.Id) && lp.OrganizationMembership.Status == MembershipStatus.Active);
        if (eligibleCount != playerIds.Count)
        {
            throw new ConflictException("A player is no longer an active league member. Cancel this invite and create a new one.");
        }
    }

    /// <summary>
    /// Turns the fully accepted roster into an accepted pending match and an active match,
    /// so results and ratings flow through the existing matchmaking path.
    /// </summary>
    private void StartMatch(LockedInvite locked, DateTimeOffset now)
    {
        var invite = locked.Invite;
        var teams = locked.Participants
            .Where(p => p.TeamIndex is not null && p.SlotIndex is not null)
            .GroupBy(p => p.TeamIndex!.Value)
            .OrderBy(g => g.Key)
            .Select(g => new PendingMatchTeam
            {
                OrganizationId = invite.OrganizationId,
                LeagueId = invite.LeagueId,
                Index = g.Key,
                Players = g.OrderBy(p => p.SlotIndex).Select(p => new PendingMatchTeamPlayer
                {
                    LeaguePlayerId = p.LeaguePlayerId,
                    Index = p.SlotIndex!.Value,
                }).ToList(),
            })
            .ToList();

        var pendingMatch = new V3PendingMatch
        {
            OrganizationId = invite.OrganizationId,
            LeagueId = invite.LeagueId,
            Status = AcceptanceStatus.Accepted,
            ExpiresAt = now,
            Teams = teams,
            Acceptances = locked.Participants.Select(p => new PendingMatchAcceptance
            {
                LeaguePlayerId = p.LeaguePlayerId,
                Status = AcceptanceStatus.Accepted,
                AcceptedAt = p.AcceptedAt ?? now,
            }).ToList(),
        };
        dbContext.V3PendingMatches.Add(pendingMatch);
        dbContext.V3ActiveMatches.Add(new V3ActiveMatch
        {
            OrganizationId = invite.OrganizationId,
            LeagueId = invite.LeagueId,
            PendingMatch = pendingMatch,
            StartedAt = now,
        });

        invite.Status = GameInviteStatus.Started;
        invite.PendingMatch = pendingMatch;
        invite.CurrentRoundId = null;
        invite.AcceptanceExpiresAt = null;

        // The active match now holds these players, so their invite spots are released.
        RemoveParticipants(locked, locked.Participants.ToList());
    }

    private void EndInvite(LockedInvite locked, GameInviteEndReason reason, DateTimeOffset now)
    {
        locked.Invite.Status = GameInviteStatus.Ended;
        locked.Invite.EndReason = reason;
        locked.Invite.EndedAt = now;
        locked.Invite.CurrentRoundId = null;
        locked.Invite.AcceptanceExpiresAt = null;
        RemoveParticipants(locked, locked.Participants.ToList());
    }

    // ----- Helpers ---------------------------------------------------------

    /// <summary>
    /// Settles due timers, then holds the league lock, runs <paramref name="action"/> and commits.
    /// A thrown exception rolls the whole transaction back, so a rejected request leaves no partial change.
    /// </summary>
    private async Task<Guid> MutateAsync(Guid leagueId, Func<DateTimeOffset, Task<Guid>> action)
    {
        await SettleLeagueAsync(leagueId);

        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        await LeagueCommitmentLock.AcquireAsync(dbContext, leagueId);

        var inviteId = await action(DateTimeOffset.UtcNow);

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        return inviteId;
    }

    private static void RejectIfTimedOut(LockedInvite locked, DateTimeOffset now)
    {
        if (IsDue(locked.Invite, now))
        {
            throw new ConflictException("This game invite has timed out. Reload it to see its latest state.");
        }
    }

    private sealed class LockedInvite(GameInvite invite, List<GameInviteParticipant> participants)
    {
        public GameInvite Invite { get; } = invite;
        public List<GameInviteParticipant> Participants { get; } = participants;
    }

    private async Task<LockedInvite?> LoadForUpdateAsync(Guid leagueId, Guid inviteId)
    {
        var invite = await dbContext.GameInvites
            .FirstOrDefaultAsync(i => i.Id == inviteId && i.LeagueId == leagueId);
        if (invite is null)
        {
            return null;
        }

        var participants = await dbContext.GameInviteParticipants
            .Where(p => p.GameInviteId == inviteId)
            .OrderBy(p => p.JoinedAt)
            .ToListAsync();

        return new LockedInvite(invite, participants);
    }

    private async Task<LockedInvite> RequireLockedInviteAsync(Guid leagueId, Guid inviteId) =>
        await LoadForUpdateAsync(leagueId, inviteId) ?? throw new NotFoundException("Game invite not found");

    private async Task RequireInviteInLeagueAsync(Guid leagueId, Guid inviteId)
    {
        var exists = await dbContext.GameInvites.AnyAsync(i => i.Id == inviteId && i.LeagueId == leagueId);
        if (!exists)
        {
            throw new NotFoundException("Game invite not found");
        }
    }

    private async Task<GameInvite> FindByShareCodeAsync(string shareCode)
    {
        var code = shareCode.Trim().ToUpperInvariant();
        return await dbContext.GameInvites.AsNoTracking().FirstOrDefaultAsync(i => i.ShareCode == code)
            ?? throw new NotFoundException("Game invite not found");
    }

    private static GameInviteParticipant NewParticipant(GameInvite invite, Guid leaguePlayerId, Guid representativeId, DateTimeOffset now) =>
        new()
        {
            OrganizationId = invite.OrganizationId,
            LeagueId = invite.LeagueId,
            GameInviteId = invite.Id,
            LeaguePlayerId = leaguePlayerId,
            RepresentativeLeaguePlayerId = representativeId,
            JoinedAt = now,
            AcceptanceStatus = AcceptanceStatus.Pending,
        };

    private void AddParticipant(LockedInvite locked, GameInviteParticipant participant)
    {
        dbContext.GameInviteParticipants.Add(participant);
        locked.Participants.Add(participant);
    }

    private void RemoveParticipants(LockedInvite locked, IReadOnlyCollection<GameInviteParticipant> toRemove)
    {
        if (toRemove.Count == 0)
        {
            return;
        }

        var removedIds = toRemove.Select(p => p.LeaguePlayerId).ToHashSet();
        var creatorId = locked.Invite.CreatedByLeaguePlayerId;

        foreach (var participant in toRemove)
        {
            dbContext.GameInviteParticipants.Remove(participant);
            locked.Participants.Remove(participant);
        }

        // Anyone represented by a removed participant passes to the creator.
        foreach (var remaining in locked.Participants)
        {
            if (removedIds.Contains(remaining.RepresentativeLeaguePlayerId))
            {
                remaining.RepresentativeLeaguePlayerId = creatorId;
            }
        }
    }

    private static GameInviteParticipant RequireParticipant(LockedInvite locked, Guid leaguePlayerId) =>
        locked.Participants.FirstOrDefault(p => p.LeaguePlayerId == leaguePlayerId)
        ?? throw new ForbiddenException("You are not in this game invite.");

    private static void RequireWaiting(LockedInvite locked)
    {
        if (locked.Invite.Status != GameInviteStatus.Waiting)
        {
            throw new ConflictException("The roster is locked while players are accepting teams.");
        }
    }

    private async Task<int> GetCapacityAsync(Guid leagueId)
    {
        var teamSize = await dbContext.Leagues
            .AsNoTracking()
            .Where(l => l.Id == leagueId)
            .Select(l => l.TeamSize)
            .FirstAsync();
        return teamSize * 2;
    }

    private async Task<string> GenerateShareCodeAsync()
    {
        while (true)
        {
            var code = new string(Enumerable.Range(0, ShareCodeLength)
                .Select(_ => ShareCodeAlphabet[RandomNumberGenerator.GetInt32(ShareCodeAlphabet.Length)])
                .ToArray());

            if (!await dbContext.GameInvites.AnyAsync(i => i.ShareCode == code))
            {
                return code;
            }
        }
    }

    private static string DescribeCommitment(LeagueCommitment commitment, string? subject)
    {
        var self = subject is null;
        return commitment switch
        {
            LeagueCommitment.Queue => self
                ? "You are in the queue. Leave it before joining a game invite."
                : $"{subject} is in the queue and must leave it before joining a game invite.",
            LeagueCommitment.PendingMatch => self
                ? "You have a pending match in this league."
                : $"{subject} has a pending match in this league.",
            LeagueCommitment.ActiveMatch => self
                ? "You are in an active match in this league."
                : $"{subject} is in an active match in this league.",
            _ => self
                ? "You are already in a game invite in this league."
                : $"{subject} is already in a game invite in this league.",
        };
    }

    private async Task<LeaguePlayer> RequireLeaguePlayerAsync(Guid orgId, Guid leagueId)
    {
        var (eligibility, leaguePlayer) = await ResolveEligibilityAsync(orgId, leagueId);
        if (eligibility != GameInviteEligibility.Eligible || leaguePlayer is null)
        {
            throw new ForbiddenException("You must be a member of this league to use game invites.");
        }

        return leaguePlayer;
    }

    private async Task<LeaguePlayer> RequireEligibleLeaguePlayerAsync(Guid orgId, Guid leagueId)
    {
        var (eligibility, leaguePlayer) = await ResolveEligibilityAsync(orgId, leagueId);
        return eligibility switch
        {
            GameInviteEligibility.Eligible when leaguePlayer is not null => leaguePlayer,
            GameInviteEligibility.NotOrganizationMember =>
                throw new ForbiddenException("Join the organization before joining this game."),
            _ => throw new ForbiddenException("You must be a member of this league to join this game."),
        };
    }

    private async Task<(GameInviteEligibility Eligibility, LeaguePlayer? LeaguePlayer)> ResolveEligibilityAsync(
        Guid orgId,
        Guid leagueId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var membershipId = await dbContext.OrganizationMemberships
            .AsNoTracking()
            .Where(m => m.OrganizationId == orgId
                        && m.Status == MembershipStatus.Active
                        && m.User != null
                        && m.User.IdentityUserId == identityUserId)
            .Select(m => (Guid?)m.Id)
            .FirstOrDefaultAsync();

        if (membershipId is null)
        {
            return (GameInviteEligibility.NotOrganizationMember, null);
        }

        var leaguePlayer = await dbContext.LeaguePlayers
            .AsNoTracking()
            .FirstOrDefaultAsync(lp => lp.LeagueId == leagueId
                                       && lp.OrganizationId == orgId
                                       && lp.OrganizationMembershipId == membershipId.Value);

        return leaguePlayer is null
            ? (GameInviteEligibility.NotLeagueMember, null)
            : (GameInviteEligibility.Eligible, leaguePlayer);
    }

    private async Task<GameInviteResponse> MapInviteAsync(Guid inviteId)
    {
        var invite = await dbContext.GameInvites
            .AsNoTracking()
            .FirstAsync(i => i.Id == inviteId);

        var capacity = await GetCapacityAsync(invite.LeagueId);

        var participants = await dbContext.GameInviteParticipants
            .AsNoTracking()
            .Where(p => p.GameInviteId == inviteId)
            .Include(p => p.LeaguePlayer)
                .ThenInclude(lp => lp.OrganizationMembership)
                .ThenInclude(om => om.User)
            .OrderBy(p => p.JoinedAt)
            .ToListAsync();

        var teams = participants
            .Where(p => p.TeamIndex is not null && p.SlotIndex is not null)
            .GroupBy(p => p.TeamIndex!.Value)
            .OrderBy(g => g.Key)
            .Select(g => new PendingMatchTeamResponse
            {
                Index = g.Key,
                Players = g.OrderBy(p => p.SlotIndex).Select(p => new PendingMatchTeamPlayerResponse
                {
                    LeaguePlayerId = p.LeaguePlayerId,
                    DisplayName = p.LeaguePlayer.OrganizationMembership.GetDisplayName(),
                    Username = p.LeaguePlayer.OrganizationMembership.GetUsername(),
                    Index = p.SlotIndex!.Value,
                }).ToList(),
            })
            .ToList();

        return new GameInviteResponse
        {
            Id = invite.Id,
            ShareCode = invite.ShareCode,
            Status = invite.Status,
            EndReason = invite.EndReason,
            CreatedAt = invite.CreatedAt,
            ExpiresAt = invite.ExpiresAt,
            AcceptanceExpiresAt = invite.AcceptanceExpiresAt,
            RoundId = invite.CurrentRoundId,
            Capacity = capacity,
            CreatedByLeaguePlayerId = invite.CreatedByLeaguePlayerId,
            PendingMatchId = invite.PendingMatchId,
            Participants = participants.Select(p => new GameInviteParticipantResponse
            {
                LeaguePlayerId = p.LeaguePlayerId,
                DisplayName = p.LeaguePlayer.OrganizationMembership.GetDisplayName(),
                Username = p.LeaguePlayer.OrganizationMembership.GetUsername(),
                RepresentativeLeaguePlayerId = p.RepresentativeLeaguePlayerId,
                IsCreator = p.LeaguePlayerId == invite.CreatedByLeaguePlayerId,
                AcceptanceStatus = p.AcceptanceStatus,
                AcceptedAt = p.AcceptedAt,
                JoinedAt = p.JoinedAt,
            }).ToList(),
            Teams = teams,
        };
    }
}
