using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Extensions;
using MMRProject.Api.UserContext;
using Npgsql;

namespace MMRProject.Api.Services.V3;

public interface IMembershipClaimService
{
    Task<ClaimableMembershipsResponse> GetClaimableMembershipsAsync(Guid orgId);
    Task<MembershipClaimRequestResponse> CreateAsync(Guid orgId, CreateMembershipClaimRequest request);
    Task<MembershipClaimRequestResponse?> GetMineAsync(Guid orgId);
    Task<List<MembershipClaimRequestResponse>> ListAsync(Guid orgId, MembershipClaimStatus status);
    Task CancelAsync(Guid orgId, Guid claimId);
    Task<MembershipClaimRequestResponse> ApproveAsync(Guid orgId, Guid claimId);
    Task<MembershipClaimRequestResponse> RejectAsync(
        Guid orgId, Guid claimId, ReviewMembershipClaimRequest request);
}

public class MembershipClaimService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    ILogger<MembershipClaimService> logger) : IMembershipClaimService
{
    private const string PendingTargetIndex = "ix_membership_claim_requests_pending_target";
    private const string PendingUserIndex = "ix_membership_claim_requests_pending_user";
    private const string ActivityMessage =
        "This account already has match activity; ask about a merge instead.";

    public async Task<ClaimableMembershipsResponse> GetClaimableMembershipsAsync(Guid orgId)
    {
        var (user, requesterMembership) = await GetCurrentRequesterAsync(orgId);
        var verifiedEmail = GetVerifiedEmail();
        var targets = await LoadClaimableTargetsAsync(orgId, verifiedEmail);
        var hasExistingClaim = await dbContext.MembershipClaimRequests
            .AnyAsync(c => c.OrganizationId == orgId
                           && c.UserId == user.Id
                           && (c.Status == MembershipClaimStatus.Pending
                               || c.Status == MembershipClaimStatus.Approved));
        var hasActivity = await HasActivityAsync(requesterMembership.Id);

        return new ClaimableMembershipsResponse
        {
            RequesterEligible = targets.Count > 0 && !hasExistingClaim && !hasActivity,
            Memberships = await MapTargetsAsync(targets),
        };
    }

    public async Task<MembershipClaimRequestResponse> CreateAsync(
        Guid orgId, CreateMembershipClaimRequest request)
    {
        var (user, requesterMembership) = await GetCurrentRequesterAsync(orgId);
        var existing = await dbContext.MembershipClaimRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.OrganizationId == orgId
                                      && c.UserId == user.Id
                                      && c.Status == MembershipClaimStatus.Pending);

        if (existing != null)
        {
            if (existing.OrganizationMembershipId == request.OrganizationMembershipId)
                return await LoadAndMapAsync(orgId, existing.Id);

            throw new InvalidArgumentException(
                "Cancel your existing claim request before choosing another player.");
        }

        if (await dbContext.MembershipClaimRequests.AnyAsync(c =>
                c.OrganizationId == orgId
                && c.UserId == user.Id
                && c.Status == MembershipClaimStatus.Approved))
        {
            throw new InvalidArgumentException("This account has already claimed a player in this organization.");
        }

        await AssertNoActivityAsync(requesterMembership.Id);

        var verifiedEmail = GetVerifiedEmail();
        var target = await dbContext.OrganizationMemberships
            .AsNoTracking()
            .Where(m => m.Id == request.OrganizationMembershipId && m.OrganizationId == orgId)
            .Where(BuildClaimablePredicate(verifiedEmail))
            .FirstOrDefaultAsync()
            ?? throw new InvalidArgumentException("This player is no longer claimable.");

        var claim = new MembershipClaimRequest
        {
            OrganizationId = orgId,
            OrganizationMembershipId = target.Id,
            UserId = user.Id,
            Status = MembershipClaimStatus.Pending,
            Note = NormalizeOptional(request.Note),
            RequesterVerifiedEmail = verifiedEmail,
        };

        dbContext.MembershipClaimRequests.Add(claim);

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           {
                                               SqlState: PostgresErrorCodes.UniqueViolation,
                                               ConstraintName: PendingTargetIndex
                                           })
        {
            dbContext.ChangeTracker.Clear();
            var pending = await dbContext.MembershipClaimRequests
                .AsNoTracking()
                .FirstAsync(c => c.OrganizationMembershipId == target.Id
                                 && c.Status == MembershipClaimStatus.Pending);
            if (pending.UserId == user.Id)
                return await LoadAndMapAsync(orgId, pending.Id);

            throw new ConflictException("Another member already has a pending request for this player.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           {
                                               SqlState: PostgresErrorCodes.UniqueViolation,
                                               ConstraintName: PendingUserIndex
                                           })
        {
            dbContext.ChangeTracker.Clear();
            var pending = await dbContext.MembershipClaimRequests
                .AsNoTracking()
                .FirstAsync(c => c.OrganizationId == orgId
                                 && c.UserId == user.Id
                                 && c.Status == MembershipClaimStatus.Pending);
            if (pending.OrganizationMembershipId == target.Id)
                return await LoadAndMapAsync(orgId, pending.Id);

            throw new InvalidArgumentException(
                "Cancel your existing claim request before choosing another player.");
        }

        return await LoadAndMapAsync(orgId, claim.Id);
    }

    public async Task<MembershipClaimRequestResponse?> GetMineAsync(Guid orgId)
    {
        var (user, _) = await GetCurrentRequesterAsync(orgId);
        var claimId = await dbContext.MembershipClaimRequests
            .AsNoTracking()
            .Where(c => c.OrganizationId == orgId && c.UserId == user.Id)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync();

        return claimId.HasValue ? await LoadAndMapAsync(orgId, claimId.Value) : null;
    }

    public async Task<List<MembershipClaimRequestResponse>> ListAsync(
        Guid orgId, MembershipClaimStatus status)
    {
        var claims = await LoadRequestsAsync(dbContext.MembershipClaimRequests
            .AsNoTracking()
            .Where(c => c.OrganizationId == orgId && c.Status == status)
            .OrderBy(c => c.CreatedAt));

        return await MapRequestsAsync(claims);
    }

    public async Task CancelAsync(Guid orgId, Guid claimId)
    {
        var (user, actorMembership) = await GetCurrentRequesterAsync(orgId);
        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var claim = await LockClaimAsync(orgId, claimId)
            ?? throw new NotFoundException("Claim request not found");

        if (claim.UserId != user.Id && actorMembership.Role > OrganizationRole.Moderator)
            throw new ForbiddenException("You can only cancel your own claim request");

        if (claim.Status == MembershipClaimStatus.Cancelled)
        {
            await transaction.CommitAsync();
            return;
        }

        if (claim.Status != MembershipClaimStatus.Pending)
            throw new ConflictException($"This claim request was already decided as {claim.Status}.");

        claim.Status = MembershipClaimStatus.Cancelled;
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task<MembershipClaimRequestResponse> RejectAsync(
        Guid orgId, Guid claimId, ReviewMembershipClaimRequest request)
    {
        var (_, actorMembership) = await GetCurrentRequesterAsync(orgId);
        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var claim = await LockClaimAsync(orgId, claimId)
            ?? throw new NotFoundException("Claim request not found");

        if (claim.Status != MembershipClaimStatus.Pending)
            throw new ConflictException($"This claim request was already decided as {claim.Status}.");

        claim.Status = MembershipClaimStatus.Rejected;
        claim.ReviewNote = NormalizeOptional(request.ReviewNote);
        claim.ReviewedByMembershipId = actorMembership.Id;
        claim.ReviewedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        return await LoadAndMapAsync(orgId, claim.Id);
    }

    public async Task<MembershipClaimRequestResponse> ApproveAsync(Guid orgId, Guid claimId)
    {
        var (actorUser, actorMembership) = await GetCurrentRequesterAsync(orgId);
        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var claim = await LockClaimAsync(orgId, claimId)
            ?? throw new NotFoundException("Claim request not found");

        if (claim.Status == MembershipClaimStatus.Approved)
        {
            await transaction.CommitAsync();
            return await LoadAndMapAsync(orgId, claim.Id);
        }

        if (claim.Status is MembershipClaimStatus.Rejected or MembershipClaimStatus.Cancelled)
            throw new InvalidArgumentException($"This claim request was already decided as {claim.Status}.");

        if (claim.UserId == actorUser.Id && actorMembership.Role != OrganizationRole.Owner)
            throw new ForbiddenException("Moderators cannot approve their own claim requests");

        var target = await LockMembershipAsync(orgId, claim.OrganizationMembershipId)
            ?? throw new InvalidArgumentException("This player is no longer claimable.");
        if (!BuildClaimablePredicate(claim.RequesterVerifiedEmail).Compile()(target))
            throw new InvalidArgumentException("This player is no longer claimable.");

        var claimantMembershipId = await dbContext.OrganizationMemberships
            .AsNoTracking()
            .Where(m => m.OrganizationId == orgId
                        && m.UserId == claim.UserId
                        && m.Status == MembershipStatus.Active)
            .Select(m => (Guid?)m.Id)
            .FirstOrDefaultAsync()
            ?? throw new InvalidArgumentException("The requester is no longer an active member.");
        var claimantMembership = await LockMembershipAsync(orgId, claimantMembershipId)
            ?? throw new InvalidArgumentException("The requester is no longer an active member.");
        if (claimantMembership.UserId != claim.UserId
            || claimantMembership.Status != MembershipStatus.Active)
        {
            throw new InvalidArgumentException("The requester is no longer an active member.");
        }

        if (claim.UserId == actorUser.Id && claimantMembership.Role != OrganizationRole.Owner)
            throw new ForbiddenException("Moderators cannot approve their own claim requests");

        await AssertNoActivityAsync(claimantMembership.Id);
        var claimantRole = claimantMembership.Role;
        var now = DateTimeOffset.UtcNow;

        var claimantPlayerIds = await dbContext.LeaguePlayers
            .Where(lp => lp.OrganizationMembershipId == claimantMembership.Id)
            .Select(lp => lp.Id)
            .ToListAsync();

        if (claimantPlayerIds.Count > 0)
        {
            var staleTeamPlayers = await dbContext.PendingMatchTeamPlayers
                .Where(p => claimantPlayerIds.Contains(p.LeaguePlayerId)
                            && p.PendingMatchTeam.PendingMatch.Status == AcceptanceStatus.Declined)
                .ToListAsync();
            var staleAcceptances = await dbContext.PendingMatchAcceptances
                .Where(a => claimantPlayerIds.Contains(a.LeaguePlayerId)
                            && a.PendingMatch.Status == AcceptanceStatus.Declined)
                .ToListAsync();
            var queueEntries = await dbContext.QueueEntries
                .Where(q => claimantPlayerIds.Contains(q.LeaguePlayerId))
                .ToListAsync();
            var leaguePlayers = await dbContext.LeaguePlayers
                .Where(lp => claimantPlayerIds.Contains(lp.Id))
                .ToListAsync();

            dbContext.PendingMatchTeamPlayers.RemoveRange(staleTeamPlayers);
            dbContext.PendingMatchAcceptances.RemoveRange(staleAcceptances);
            dbContext.QueueEntries.RemoveRange(queueEntries);
            dbContext.LeaguePlayers.RemoveRange(leaguePlayers);
        }

        var flags = await dbContext.V3MatchFlags
            .Where(f => f.FlaggedByMembershipId == claimantMembership.Id
                        || f.ResolvedByMembershipId == claimantMembership.Id)
            .ToListAsync();
        foreach (var flag in flags)
        {
            if (flag.FlaggedByMembershipId == claimantMembership.Id)
                flag.FlaggedByMembershipId = target.Id;
            if (flag.ResolvedByMembershipId == claimantMembership.Id)
                flag.ResolvedByMembershipId = target.Id;
        }

        claimantMembership.UserId = null;
        claimantMembership.InviteEmail = null;
        claimantMembership.Status = MembershipStatus.Removed;

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           { SqlState: PostgresErrorCodes.ForeignKeyViolation })
        {
            throw new ConflictException("Concurrent match activity was recorded. Retry the claim review.");
        }

        target.UserId = claim.UserId;
        target.InviteEmail = null;
        target.Status = MembershipStatus.Active;
        target.ClaimedAt = now;
        target.Role = claimantRole;
        target.RoleAssignedByMembershipId = actorMembership.Id;
        target.RoleAssignedAt = now;

        claim.Status = MembershipClaimStatus.Approved;
        claim.ReviewedByMembershipId = actorMembership.Id;
        claim.ReviewedAt = now;
        claim.RetiredMembershipId = claimantMembership.Id;

        var otherPendingClaims = await dbContext.MembershipClaimRequests
            .Where(c => c.OrganizationId == orgId
                        && c.UserId == claim.UserId
                        && c.Id != claim.Id
                        && c.Status == MembershipClaimStatus.Pending)
            .ToListAsync();
        foreach (var otherClaim in otherPendingClaims)
            otherClaim.Status = MembershipClaimStatus.Cancelled;

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        logger.LogInformation(
            "Approved membership claim {ClaimId}: target {TargetMembershipId}, retired {RetiredMembershipId}, actor {ActorMembershipId}",
            claim.Id, target.Id, claimantMembership.Id, actorMembership.Id);

        return await LoadAndMapAsync(orgId, claim.Id);
    }

    private async Task<(User User, OrganizationMembership Membership)> GetCurrentRequesterAsync(Guid orgId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId)
            ?? throw new NotFoundException("User not found");
        var membership = await dbContext.OrganizationMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId
                                      && m.UserId == user.Id
                                      && m.Status == MembershipStatus.Active)
            ?? throw new ForbiddenException("You are not an active member of this organization");
        return (user, membership);
    }

    private string? GetVerifiedEmail()
    {
        if (!userContextResolver.IsEmailVerified())
            return null;

        var email = userContextResolver.GetEmail();
        return string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
    }

    private static Expression<Func<OrganizationMembership, bool>> BuildClaimablePredicate(
        string? requesterVerifiedEmail)
    {
        return membership => membership.UserId == null
                             && membership.Status != MembershipStatus.Removed
                             && ((membership.InviteEmail == null
                                  && membership.Status == MembershipStatus.Active)
                                 || (requesterVerifiedEmail != null
                                     && membership.InviteEmail != null
                                     && membership.InviteEmail.ToLower() == requesterVerifiedEmail));
    }

    private async Task<List<OrganizationMembership>> LoadClaimableTargetsAsync(
        Guid orgId, string? requesterVerifiedEmail)
    {
        return await dbContext.OrganizationMemberships
            .AsNoTracking()
            .Where(m => m.OrganizationId == orgId)
            .Where(BuildClaimablePredicate(requesterVerifiedEmail))
            .OrderBy(m => m.DisplayName)
            .ThenBy(m => m.Username)
            .ToListAsync();
    }

    private async Task<bool> HasActivityAsync(Guid membershipId)
    {
        var playerIds = await dbContext.LeaguePlayers
            .Where(lp => lp.OrganizationMembershipId == membershipId)
            .Select(lp => lp.Id)
            .ToListAsync();
        if (playerIds.Count == 0)
            return false;

        if (await dbContext.RatingHistories.AnyAsync(r => playerIds.Contains(r.LeaguePlayerId))
            || await dbContext.MatchTeamPlayers.AnyAsync(p => playerIds.Contains(p.LeaguePlayerId)))
        {
            return true;
        }

        return await dbContext.PendingMatchTeamPlayers.AnyAsync(p =>
                   playerIds.Contains(p.LeaguePlayerId)
                   && (p.PendingMatchTeam.PendingMatch.Status == AcceptanceStatus.Pending
                       || p.PendingMatchTeam.PendingMatch.Status == AcceptanceStatus.Accepted))
               || await dbContext.PendingMatchAcceptances.AnyAsync(a =>
                   playerIds.Contains(a.LeaguePlayerId)
                   && (a.PendingMatch.Status == AcceptanceStatus.Pending
                       || a.PendingMatch.Status == AcceptanceStatus.Accepted));
    }

    private async Task AssertNoActivityAsync(Guid membershipId)
    {
        if (await HasActivityAsync(membershipId))
            throw new InvalidArgumentException(ActivityMessage);
    }

    private async Task<MembershipClaimRequest?> LockClaimAsync(Guid orgId, Guid claimId)
    {
        return await dbContext.MembershipClaimRequests
            .FromSqlInterpolated(
                $"SELECT * FROM membership_claim_requests WHERE id = {claimId} AND organization_id = {orgId} FOR UPDATE")
            .AsTracking()
            .FirstOrDefaultAsync();
    }

    private async Task<OrganizationMembership?> LockMembershipAsync(Guid orgId, Guid membershipId)
    {
        var tracked = dbContext.ChangeTracker.Entries<OrganizationMembership>()
            .FirstOrDefault(e => e.Entity.Id == membershipId);
        var membership = await dbContext.OrganizationMemberships
            .FromSqlInterpolated(
                $"SELECT *, xmin FROM organization_memberships WHERE id = {membershipId} AND organization_id = {orgId} FOR UPDATE")
            .AsTracking()
            .FirstOrDefaultAsync();

        if (membership != null && tracked != null)
        {
            await tracked.ReloadAsync();
            membership = tracked.Entity;
        }

        return membership;
    }

    private async Task<MembershipClaimRequestResponse> LoadAndMapAsync(Guid orgId, Guid claimId)
    {
        var claims = await LoadRequestsAsync(dbContext.MembershipClaimRequests
            .AsNoTracking()
            .Where(c => c.OrganizationId == orgId && c.Id == claimId));
        var claim = claims.SingleOrDefault()
            ?? throw new NotFoundException("Claim request not found");
        return (await MapRequestsAsync([claim])).Single();
    }

    private static Task<List<MembershipClaimRequest>> LoadRequestsAsync(
        IQueryable<MembershipClaimRequest> query)
    {
        return query
            .Include(c => c.User)
            .Include(c => c.OrganizationMembership)
                .ThenInclude(m => m.User)
            .ToListAsync();
    }

    private async Task<List<MembershipClaimRequestResponse>> MapRequestsAsync(
        List<MembershipClaimRequest> claims)
    {
        var targets = claims.Select(c => c.OrganizationMembership).DistinctBy(m => m.Id).ToList();
        var mappedTargets = (await MapTargetsAsync(targets))
            .ToDictionary(t => t.OrganizationMembershipId);

        return claims.Select(claim => new MembershipClaimRequestResponse
        {
            Id = claim.Id,
            OrganizationId = claim.OrganizationId,
            OrganizationMembershipId = claim.OrganizationMembershipId,
            UserId = claim.UserId,
            RequesterDisplayName = claim.User.DisplayName ?? claim.User.Username,
            RequesterEmail = claim.User.Email,
            Target = mappedTargets[claim.OrganizationMembershipId],
            Status = claim.Status,
            Note = claim.Note,
            ReviewNote = claim.ReviewNote,
            ReviewedByMembershipId = claim.ReviewedByMembershipId,
            ReviewedAt = claim.ReviewedAt,
            RetiredMembershipId = claim.RetiredMembershipId,
            CreatedAt = claim.CreatedAt,
        }).ToList();
    }

    private async Task<List<ClaimableMembershipResponse>> MapTargetsAsync(
        List<OrganizationMembership> memberships)
    {
        var membershipIds = memberships.Select(m => m.Id).ToList();
        var stats = membershipIds.Count == 0
            ? []
            : await dbContext.RatingHistories
                .AsNoTracking()
                .Where(r => membershipIds.Contains(r.LeaguePlayer.OrganizationMembershipId))
                .GroupBy(r => new
                {
                    r.LeaguePlayer.OrganizationMembershipId,
                    r.LeaguePlayer.LeagueId,
                    r.LeaguePlayer.League.Name,
                })
                .Select(group => new ClaimStats(
                    group.Key.OrganizationMembershipId,
                    group.Key.LeagueId,
                    group.Key.Name,
                    group.Count(),
                    group.Max(r => r.Match.PlayedAt)))
                .ToListAsync();

        return memberships.Select(membership =>
        {
            var membershipStats = stats.Where(s => s.MembershipId == membership.Id).ToList();
            return new ClaimableMembershipResponse
            {
                OrganizationMembershipId = membership.Id,
                DisplayName = membership.GetDisplayName(),
                Username = membership.GetUsername(),
                MatchCount = membershipStats.Sum(s => s.MatchCount),
                LastPlayedAt = membershipStats.Count == 0
                    ? null
                    : membershipStats.Max(s => s.LastPlayedAt),
                Leagues = membershipStats.Select(s => new ClaimableMembershipLeagueStatsResponse
                {
                    LeagueId = s.LeagueId,
                    LeagueName = s.LeagueName,
                    MatchCount = s.MatchCount,
                    LastPlayedAt = s.LastPlayedAt,
                }).ToList(),
            };
        }).ToList();
    }

    private static string? NormalizeOptional(string? value)
    {
        if (value == null)
            return null;
        var trimmed = value.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    private sealed record ClaimStats(
        Guid MembershipId,
        Guid LeagueId,
        string LeagueName,
        int MatchCount,
        DateTimeOffset LastPlayedAt);
}
