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
    IV3UserService userService) : IInviteLinkService
{
    private const string AllowedChars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

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

        var existingMembership = await dbContext.OrganizationMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == link.OrganizationId
                                      && m.UserId == user.Id
                                      && m.Status == MembershipStatus.Active);

        if (existingMembership != null)
            throw new InvalidArgumentException("You are already a member of this organization");

        // Check for pending email invite and claim it
        var pendingInvite = await dbContext.OrganizationMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == link.OrganizationId
                                      && m.InviteEmail == email
                                      && m.Status == MembershipStatus.Invited);

        OrganizationMembership membership;
        if (pendingInvite != null)
        {
            pendingInvite.UserId = user.Id;
            pendingInvite.DisplayName = user.DisplayName;
            pendingInvite.Username = user.Username;
            pendingInvite.Status = MembershipStatus.Active;
            pendingInvite.ClaimedAt = DateTimeOffset.UtcNow;
            membership = pendingInvite;
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
        var pendingInvites = await dbContext.OrganizationMemberships
            .Where(m => m.InviteEmail == email && m.Status == MembershipStatus.Invited)
            .ToListAsync();

        if (pendingInvites.Count == 0)
            return;

        var user = await dbContext.V3Users.FindAsync(userId);
        if (user == null)
            return;

        var orgIds = pendingInvites.Select(i => i.OrganizationId).Distinct().ToList();
        var existingOrgIds = (await dbContext.OrganizationMemberships
            .Where(m => m.UserId == userId && orgIds.Contains(m.OrganizationId) && m.Status == MembershipStatus.Active)
            .Select(m => m.OrganizationId)
            .ToListAsync())
            .ToHashSet();

        foreach (var invite in pendingInvites)
        {
            if (existingOrgIds.Contains(invite.OrganizationId))
                continue;

            invite.UserId = userId;
            invite.DisplayName = user.DisplayName;
            invite.Username = user.Username;
            invite.Status = MembershipStatus.Active;
            invite.ClaimedAt = DateTimeOffset.UtcNow;
        }

        await dbContext.SaveChangesAsync();
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
        return string.Create(6, AllowedChars, (span, chars) =>
        {
            Span<byte> randomBytes = stackalloc byte[6];
            RandomNumberGenerator.Fill(randomBytes);
            for (var i = 0; i < span.Length; i++)
            {
                span[i] = chars[randomBytes[i] % chars.Length];
            }
        });
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
