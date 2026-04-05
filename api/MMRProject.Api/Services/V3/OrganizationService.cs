using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Extensions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface IOrganizationService
{
    Task<OrganizationResponse> CreateOrganizationAsync(CreateOrganizationRequest request);
    Task<OrganizationResponse> GetOrganizationAsync(Guid orgId);
    Task<OrganizationResponse?> GetOrganizationBySlugAsync(string slug);
    Task<OrganizationResponse> UpdateOrganizationAsync(Guid orgId, UpdateOrganizationRequest request);
    Task<List<OrganizationMemberResponse>> ListMembersAsync(Guid orgId);
    Task<OrganizationMemberResponse> InviteMemberAsync(Guid orgId, InviteMemberRequest request);
    Task<OrganizationMemberResponse> UpdateMemberRoleAsync(Guid orgId, Guid membershipId, UpdateMemberRoleRequest request);
    Task RemoveMemberAsync(Guid orgId, Guid membershipId);
    Task<OrganizationMembership?> GetMembershipForCurrentUserAsync(Guid orgId);
    Task<Guid> GetCurrentMembershipIdAsync(Guid orgId);
}

public class OrganizationService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    IV3UserService userService) : IOrganizationService
{
    private static readonly HashSet<string> ReservedSlugs = new(StringComparer.OrdinalIgnoreCase)
    {
        "submit", "player", "admin", "statistics", "matchmaking",
        "random", "profile", "login", "api", "new-player", "active-match",
        "join", "settings"
    };

    public async Task<OrganizationResponse> CreateOrganizationAsync(CreateOrganizationRequest request)
    {
        ValidateSlug(request.Slug);

        var existingOrg = await dbContext.Organizations
            .FirstOrDefaultAsync(o => o.Slug == request.Slug);
        if (existingOrg != null)
            throw new InvalidArgumentException($"An organization with slug '{request.Slug}' already exists");

        var identityUserId = userContextResolver.GetIdentityUserId();
        var email = userContextResolver.GetEmail()
                    ?? throw new InvalidArgumentException("Email claim is required");
        var user = await userService.EnsureUserAsync(identityUserId, email, null, null);

        var org = new Organization
        {
            Name = request.Name,
            Slug = request.Slug
        };
        dbContext.Organizations.Add(org);

        var membership = new OrganizationMembership
        {
            OrganizationId = org.Id,
            UserId = user.Id,
            DisplayName = user.DisplayName,
            Username = user.Username,
            Role = OrganizationRole.Owner,
            Status = MembershipStatus.Active,
            ClaimedAt = DateTimeOffset.UtcNow
        };
        dbContext.OrganizationMemberships.Add(membership);

        await dbContext.SaveChangesAsync();

        return MapToResponse(org);
    }

    public async Task<OrganizationResponse> GetOrganizationAsync(Guid orgId)
    {
        var org = await dbContext.Organizations.FindAsync(orgId)
                  ?? throw new NotFoundException($"Organization with ID '{orgId}' not found");

        return MapToResponse(org);
    }

    public async Task<OrganizationResponse?> GetOrganizationBySlugAsync(string slug)
    {
        var org = await dbContext.Organizations
            .FirstOrDefaultAsync(o => o.Slug == slug);

        return org == null ? null : MapToResponse(org);
    }

    public async Task<OrganizationResponse> UpdateOrganizationAsync(Guid orgId, UpdateOrganizationRequest request)
    {
        var org = await dbContext.Organizations.FindAsync(orgId)
                  ?? throw new NotFoundException($"Organization with ID '{orgId}' not found");

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                throw new InvalidArgumentException("Name cannot be empty");
            org.Name = request.Name;
        }

        if (request.Slug != null)
        {
            ValidateSlug(request.Slug);

            var existingOrg = await dbContext.Organizations
                .FirstOrDefaultAsync(o => o.Slug == request.Slug && o.Id != orgId);
            if (existingOrg != null)
                throw new InvalidArgumentException($"An organization with slug '{request.Slug}' already exists");

            org.Slug = request.Slug;
        }

        await dbContext.SaveChangesAsync();

        return MapToResponse(org);
    }

    public async Task<List<OrganizationMemberResponse>> ListMembersAsync(Guid orgId)
    {
        var members = await dbContext.OrganizationMemberships
            .AsNoTracking()
            .Include(m => m.User)
            .Where(m => m.OrganizationId == orgId && m.Status != MembershipStatus.Removed)
            .ToListAsync();

        return members.Select(MapToMemberResponse).ToList();
    }

    public async Task<OrganizationMemberResponse> InviteMemberAsync(Guid orgId, InviteMemberRequest request)
    {
        var currentUserMembership = await GetMembershipForCurrentUserAsync(orgId)
            ?? throw new ForbiddenException("You are not a member of this organization");

        if (request.Role < currentUserMembership.Role)
            throw new ForbiddenException("You can only invite members at your role level or below");

        var existing = await dbContext.OrganizationMemberships
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId
                                      && m.InviteEmail == request.Email
                                      && m.Status != MembershipStatus.Removed);

        if (existing != null)
            throw new InvalidArgumentException($"A member with email '{request.Email}' has already been invited");

        var existingByUser = await dbContext.OrganizationMemberships
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId
                                      && m.User != null
                                      && m.User.Email == request.Email
                                      && m.Status != MembershipStatus.Removed);

        if (existingByUser != null)
            throw new InvalidArgumentException($"A member with email '{request.Email}' already exists in this organization");

        var removedMembership = await dbContext.OrganizationMemberships
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId
                                      && m.Status == MembershipStatus.Removed
                                      && (m.InviteEmail == request.Email
                                          || (m.User != null && m.User.Email == request.Email)));

        if (removedMembership != null)
        {
            removedMembership.InviteEmail = request.Email;
            removedMembership.Role = request.Role;
            removedMembership.Status = MembershipStatus.Invited;
            removedMembership.ClaimedAt = null;

            await dbContext.SaveChangesAsync();

            return MapToMemberResponse(removedMembership);
        }

        var membership = new OrganizationMembership
        {
            OrganizationId = orgId,
            InviteEmail = request.Email,
            Role = request.Role,
            Status = MembershipStatus.Invited
        };

        dbContext.OrganizationMemberships.Add(membership);
        await dbContext.SaveChangesAsync();

        return MapToMemberResponse(membership);
    }

    public async Task<OrganizationMemberResponse> UpdateMemberRoleAsync(
        Guid orgId, Guid membershipId, UpdateMemberRoleRequest request)
    {
        var membership = await dbContext.OrganizationMemberships
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.Id == membershipId
                                      && m.OrganizationId == orgId
                                      && m.Status != MembershipStatus.Removed)
            ?? throw new NotFoundException($"Membership with ID '{membershipId}' not found");

        var currentUserMembership = await GetMembershipForCurrentUserAsync(orgId)
            ?? throw new ForbiddenException("You are not a member of this organization");

        if (membership.Role == OrganizationRole.Owner && request.Role != OrganizationRole.Owner)
        {
            var hasOtherOwner = await dbContext.OrganizationMemberships
                .AnyAsync(m => m.OrganizationId == orgId
                               && m.Status == MembershipStatus.Active
                               && m.Role == OrganizationRole.Owner
                               && m.Id != membershipId);
            if (!hasOtherOwner)
                throw new InvalidArgumentException("Cannot remove the last owner of the organization");
        }

        membership.Role = request.Role;
        membership.RoleAssignedByMembershipId = currentUserMembership.Id;
        membership.RoleAssignedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync();

        return MapToMemberResponse(membership);
    }

    public async Task RemoveMemberAsync(Guid orgId, Guid membershipId)
    {
        var membership = await dbContext.OrganizationMemberships
            .FirstOrDefaultAsync(m => m.Id == membershipId
                                      && m.OrganizationId == orgId
                                      && m.Status != MembershipStatus.Removed)
            ?? throw new NotFoundException($"Membership with ID '{membershipId}' not found");

        if (membership.Role == OrganizationRole.Owner)
        {
            var hasOtherOwner = await dbContext.OrganizationMemberships
                .AnyAsync(m => m.OrganizationId == orgId
                               && m.Status == MembershipStatus.Active
                               && m.Role == OrganizationRole.Owner
                               && m.Id != membershipId);
            if (!hasOtherOwner)
                throw new InvalidArgumentException("Cannot remove the last owner of the organization");
        }

        membership.Status = MembershipStatus.Removed;

        await dbContext.SaveChangesAsync();
    }

    public async Task<OrganizationMembership?> GetMembershipForCurrentUserAsync(Guid orgId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        return await dbContext.OrganizationMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId
                                      && m.User != null && m.User.IdentityUserId == identityUserId
                                      && m.Status == MembershipStatus.Active);
    }

    public async Task<Guid> GetCurrentMembershipIdAsync(Guid orgId)
    {
        var membership = await GetMembershipForCurrentUserAsync(orgId)
            ?? throw new NotFoundException("You are not a member of this organization");
        return membership.Id;
    }

    private static void ValidateSlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
            throw new InvalidArgumentException("Slug cannot be empty");

        if (ReservedSlugs.Contains(slug))
            throw new InvalidArgumentException($"The slug '{slug}' is reserved and cannot be used");
    }

    private static OrganizationResponse MapToResponse(Organization org)
    {
        return new OrganizationResponse
        {
            Id = org.Id,
            Name = org.Name,
            Slug = org.Slug,
            CreatedAt = org.CreatedAt
        };
    }

    private static OrganizationMemberResponse MapToMemberResponse(OrganizationMembership membership)
    {
        return new OrganizationMemberResponse
        {
            Id = membership.Id,
            UserId = membership.UserId,
            Email = membership.User?.Email ?? membership.InviteEmail,
            DisplayName = membership.GetDisplayName(),
            Username = membership.GetUsername(),
            Role = membership.Role,
            Status = membership.Status,
            ClaimedAt = membership.ClaimedAt,
            CreatedAt = membership.CreatedAt
        };
    }
}
