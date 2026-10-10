using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Services.V3;

internal static class MembershipLockingExtensions
{
    // Serializes claim creation with the operations that settle pending claims: member
    // removal, approval, and linking a player through an invitation. A claim inserted while
    // one of them is in flight would otherwise land after its cleanup and stay pending.
    public static async Task LockOrganizationClaimsAsync(this ApiDbContext dbContext, Guid orgId)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtext({"membership-claims:" + orgId}))");
    }

    public static async Task<IReadOnlyDictionary<Guid, OrganizationMembership>> LockMembershipsInOrderAsync(
        this ApiDbContext dbContext,
        Guid orgId,
        IEnumerable<Guid> membershipIds)
    {
        var ids = membershipIds.Distinct().ToArray();
        if (ids.Length == 0)
            return new Dictionary<Guid, OrganizationMembership>();

        var previouslyTrackedIds = dbContext.ChangeTracker
            .Entries<OrganizationMembership>()
            .Where(entry => ids.Contains(entry.Entity.Id))
            .Select(entry => entry.Entity.Id)
            .ToHashSet();

        var memberships = await dbContext.OrganizationMemberships
            .FromSqlInterpolated($"""
                SELECT *, xmin
                FROM organization_memberships
                WHERE organization_id = {orgId} AND id = ANY ({ids})
                ORDER BY id
                FOR UPDATE
                """)
            .AsTracking()
            .ToListAsync();

        foreach (var membership in memberships.Where(m => previouslyTrackedIds.Contains(m.Id)))
            await dbContext.Entry(membership).ReloadAsync();

        return memberships.ToDictionary(membership => membership.Id);
    }
}
