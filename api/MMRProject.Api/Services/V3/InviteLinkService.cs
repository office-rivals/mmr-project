using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface IInviteLinkService
{
    Task<InviteLinkResponse> CreateInviteLinkAsync(Guid orgId, CreateInviteLinkRequest request);
    Task<List<InviteLinkResponse>> ListInviteLinksAsync(Guid orgId);
    Task DeleteInviteLinkAsync(Guid orgId, Guid linkId);
    Task<InviteInfoResponse> GetInviteInfoAsync(string code);
    Task<JoinOrganizationResponse> JoinOrganizationAsync(string code);
    Task AutoClaimInvitesAsync(string email, Guid userId);
}

public class InviteLinkService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    IOrganizationService organizationService,
    IV3UserService userService,
    ILogger<InviteLinkService> logger) : IInviteLinkService
{
    private const string AllowedChars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 12;

    public async Task<InviteLinkResponse> CreateInviteLinkAsync(Guid orgId, CreateInviteLinkRequest request)
    {
        var membership = await organizationService.GetMembershipForCurrentUserAsync(orgId)
            ?? throw new ForbiddenException("You are not a member of this organization");

        var code = await GenerateUniqueCodeAsync();

        var link = new OrganizationInviteLink
        {
            OrganizationId = orgId,
            Code = code,
            CreatedByMembershipId = membership.Id,
            MaxUses = request.MaxUses,
            ExpiresAt = request.ExpiresAt
        };

        dbContext.OrganizationInviteLinks.Add(link);
        await dbContext.SaveChangesAsync();

        return MapToResponse(link);
    }

    public async Task<List<InviteLinkResponse>> ListInviteLinksAsync(Guid orgId)
    {
        var links = await dbContext.OrganizationInviteLinks
            .Where(l => l.OrganizationId == orgId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return links.Select(MapToResponse).ToList();
    }

    public async Task DeleteInviteLinkAsync(Guid orgId, Guid linkId)
    {
        var link = await dbContext.OrganizationInviteLinks
            .FirstOrDefaultAsync(l => l.Id == linkId && l.OrganizationId == orgId)
            ?? throw new NotFoundException($"Invite link with ID '{linkId}' not found");

        dbContext.OrganizationInviteLinks.Remove(link);
        await dbContext.SaveChangesAsync();
    }

    public async Task<InviteInfoResponse> GetInviteInfoAsync(string code)
    {
        var link = await dbContext.OrganizationInviteLinks
            .Include(l => l.Organization)
            .FirstOrDefaultAsync(l => l.Code == code.ToUpperInvariant());

        if (link == null)
        {
            return new InviteInfoResponse
            {
                Code = code,
                OrganizationName = "",
                OrganizationSlug = "",
                IsValid = false
            };
        }

        return new InviteInfoResponse
        {
            Code = link.Code,
            OrganizationName = link.Organization.Name,
            OrganizationSlug = link.Organization.Slug,
            IsValid = IsLinkValid(link)
        };
    }

    public async Task<JoinOrganizationResponse> JoinOrganizationAsync(string code)
    {
        var link = await dbContext.OrganizationInviteLinks
            .Include(l => l.Organization)
            .FirstOrDefaultAsync(l => l.Code == code.ToUpperInvariant())
            ?? throw new NotFoundException("Invalid invite code");

        if (!IsLinkValid(link))
            throw new InvalidArgumentException("This invite link has expired or reached its usage limit");

        var identityUserId = userContextResolver.GetIdentityUserId();
        var email = userContextResolver.GetEmail()
                    ?? throw new InvalidArgumentException("Email claim is required");
        var user = await userService.EnsureUserAsync(identityUserId, email, null, null);
        var comparisonEmail = email.Trim();

        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        await dbContext.LockOrganizationClaimsAsync(link.OrganizationId);

        var ownMembership = await dbContext.OrganizationMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == link.OrganizationId && m.UserId == user.Id);

        if (ownMembership?.Status == MembershipStatus.Active)
            throw new InvalidArgumentException("You are already a member of this organization");

        var pendingInviteMatches = await dbContext.OrganizationMemberships
            .Where(m => m.OrganizationId == link.OrganizationId
                        && m.InviteEmail != null
                        && m.InviteEmail.ToLower() == comparisonEmail.ToLower()
                        && m.Status == MembershipStatus.Invited)
            .ToListAsync();
        var pendingInvite = pendingInviteMatches.Count == 0
            ? null
            : SelectInviteEmailMatch(pendingInviteMatches, comparisonEmail);

        // The (organization, user) key covers removed rows too, so a row this user already
        // holds is the one to reactivate; linking a different invitation would collide with it.
        if (ownMembership != null && pendingInvite?.Id != ownMembership.Id)
            pendingInvite = null;

        var previousMembership = ownMembership ?? await dbContext.OrganizationMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == link.OrganizationId
                                      && m.Status == MembershipStatus.Removed
                                      && m.InviteEmail == email);

        OrganizationMembership membership;
        if (pendingInvite != null)
        {
            pendingInvite.UserId = user.Id;
            pendingInvite.DisplayName ??= user.DisplayName;
            pendingInvite.Username ??= user.Username;
            pendingInvite.InviteEmail = null;
            pendingInvite.Status = MembershipStatus.Active;
            pendingInvite.ClaimedAt = DateTimeOffset.UtcNow;
            membership = pendingInvite;
        }
        else if (previousMembership != null)
        {
            previousMembership.UserId = user.Id;
            previousMembership.DisplayName ??= user.DisplayName;
            previousMembership.Username ??= user.Username;
            previousMembership.InviteEmail = null;
            if (previousMembership.Status == MembershipStatus.Removed)
                previousMembership.Role = OrganizationRole.Member;
            previousMembership.Status = MembershipStatus.Active;
            previousMembership.ClaimedAt = DateTimeOffset.UtcNow;
            membership = previousMembership;
        }
        else
        {
            membership = new OrganizationMembership
            {
                OrganizationId = link.OrganizationId,
                UserId = user.Id,
                DisplayName = user.DisplayName,
                Username = user.Username,
                Role = OrganizationRole.Member,
                Status = MembershipStatus.Active,
                ClaimedAt = DateTimeOffset.UtcNow
            };
            dbContext.OrganizationMemberships.Add(membership);
        }

        link.UseCount++;
        await dbContext.SaveChangesAsync();

        if (pendingInvite != null)
            await CancelPendingClaimRequestsForAsync(pendingInvite.Id);
        await transaction.CommitAsync();

        return new JoinOrganizationResponse
        {
            OrganizationId = link.Organization.Id,
            OrganizationName = link.Organization.Name,
            OrganizationSlug = link.Organization.Slug,
            MembershipId = membership.Id
        };
    }

    public async Task AutoClaimInvitesAsync(string email, Guid userId)
    {
        var comparisonEmail = email.Trim();
        var pendingInviteMatches = await dbContext.OrganizationMemberships
            .AsNoTracking()
            .Where(m => m.InviteEmail != null
                        && m.InviteEmail.ToLower() == comparisonEmail.ToLower()
                        && m.Status == MembershipStatus.Invited)
            .ToListAsync();

        if (pendingInviteMatches.Count == 0)
            return;

        var user = await dbContext.V3Users.FindAsync(userId);
        if (user == null)
            return;

        var orgIds = pendingInviteMatches.Select(i => i.OrganizationId).Distinct().ToList();
        var heldMemberships = (await dbContext.OrganizationMemberships
            .AsNoTracking()
            .Where(m => m.UserId == userId && orgIds.Contains(m.OrganizationId))
            .Select(m => new { m.OrganizationId, m.Id, m.Status })
            .ToListAsync())
            .ToDictionary(m => m.OrganizationId);

        foreach (var orgInvites in pendingInviteMatches.GroupBy(invite => invite.OrganizationId))
        {
            OrganizationMembership? invite;
            if (heldMemberships.TryGetValue(orgInvites.Key, out var held))
            {
                // The (organization, user) key covers removed rows too, so only the user's own
                // row can be linked here; any other invitation would collide with it.
                invite = orgInvites.FirstOrDefault(i => i.Id == held.Id);
                if (invite == null)
                {
                    if (held.Status != MembershipStatus.Active)
                        logger.LogWarning(
                            "Skipped invitation auto-claim in organization {OrganizationId}: the user still holds membership {MembershipId} there",
                            orgInvites.Key, held.Id);
                    continue;
                }
            }
            else
            {
                // This runs on every /me, so ambiguity in one organization must not lock the
                // user out of the others; the explicit join path still reports it.
                invite = TrySelectInviteEmailMatch(orgInvites.ToList(), comparisonEmail);
                if (invite == null)
                {
                    logger.LogWarning(
                        "Skipped invitation auto-claim in organization {OrganizationId}: {MatchCount} invitations match the user's email",
                        orgInvites.Key, orgInvites.Count());
                    continue;
                }
            }

            await using var transaction = await dbContext.Database.BeginTransactionAsync();
            await dbContext.LockOrganizationClaimsAsync(orgInvites.Key);

            // Parallel /me requests race to claim the same invitation. The guarded update
            // lets the loser match no row instead of failing the membership row version.
            var claimed = await dbContext.OrganizationMemberships
                .Where(m => m.Id == invite.Id
                            && m.Status == MembershipStatus.Invited
                            && m.UserId == invite.UserId
                            && m.InviteEmail == invite.InviteEmail)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(m => m.UserId, userId)
                    .SetProperty(m => m.DisplayName, m => m.DisplayName ?? user.DisplayName)
                    .SetProperty(m => m.Username, m => m.Username ?? user.Username)
                    .SetProperty(m => m.InviteEmail, (string?)null)
                    .SetProperty(m => m.Status, MembershipStatus.Active)
                    .SetProperty(m => m.ClaimedAt, DateTimeOffset.UtcNow));

            if (claimed == 1)
                await CancelPendingClaimRequestsForAsync(invite.Id);
            await transaction.CommitAsync();
        }
    }

    // A player linked to an account through its invitation is no longer claimable,
    // so requests nominating it would otherwise stay pending with no way to approve.
    private async Task CancelPendingClaimRequestsForAsync(Guid membershipId)
    {
        await dbContext.MembershipClaimRequests
            .Where(c => c.OrganizationMembershipId == membershipId
                        && c.Status == MembershipClaimStatus.Pending)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(c => c.Status, MembershipClaimStatus.Cancelled));
    }

    private static OrganizationMembership SelectInviteEmailMatch(
        IReadOnlyCollection<OrganizationMembership> matches,
        string email)
    {
        return TrySelectInviteEmailMatch(matches, email)
               ?? throw new InvalidArgumentException(
                   "Multiple invitations match this email. Ask a moderator to resolve the duplicate invitations.");
    }

    private static OrganizationMembership? TrySelectInviteEmailMatch(
        IReadOnlyCollection<OrganizationMembership> matches,
        string email)
    {
        var exactMatches = matches
            .Where(m => string.Equals(m.InviteEmail, email, StringComparison.Ordinal))
            .ToList();
        if (exactMatches.Count == 1)
            return exactMatches[0];
        if (exactMatches.Count == 0 && matches.Count == 1)
            return matches.First();

        return null;
    }

    private async Task<string> GenerateUniqueCodeAsync()
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = GenerateCode();
            var exists = await dbContext.OrganizationInviteLinks.AnyAsync(l => l.Code == code);
            if (!exists)
                return code;
        }

        throw new InvalidOperationException("Failed to generate a unique invite code");
    }

    private static string GenerateCode()
    {
        return RandomNumberGenerator.GetString(AllowedChars, CodeLength);
    }

    private static bool IsLinkValid(OrganizationInviteLink link)
    {
        if (link.ExpiresAt.HasValue && link.ExpiresAt.Value <= DateTimeOffset.UtcNow)
            return false;

        if (link.MaxUses.HasValue && link.UseCount >= link.MaxUses.Value)
            return false;

        return true;
    }

    private static InviteLinkResponse MapToResponse(OrganizationInviteLink link)
    {
        return new InviteLinkResponse
        {
            Id = link.Id,
            Code = link.Code,
            OrganizationId = link.OrganizationId,
            MaxUses = link.MaxUses,
            UseCount = link.UseCount,
            ExpiresAt = link.ExpiresAt,
            CreatedAt = link.CreatedAt
        };
    }
}
