using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;

using Npgsql;

namespace MMRProject.Api.Services.V3;

public interface IV3MatchFlagService
{
    Task<MatchFlagResponse> CreateFlagAsync(Guid orgId, Guid leagueId, CreateMatchFlagRequest request);
    Task<List<MatchFlagResponse>> GetFlagsAsync(Guid orgId, Guid leagueId, MatchFlagStatus? status);
    Task<MatchFlagResponse> GetFlagAsync(Guid orgId, Guid leagueId, Guid flagId);
    Task<MatchFlagResponse> ResolveFlagAsync(Guid orgId, Guid leagueId, Guid flagId, ResolveMatchFlagRequest request);
    Task<List<MatchFlagResponse>> GetMyFlagsAsync(Guid orgId, Guid leagueId);
    Task<MatchFlagResponse> UpdateFlagReasonAsync(Guid orgId, Guid leagueId, Guid flagId, UpdateMatchFlagReasonRequest request);
    Task DeleteFlagAsync(Guid orgId, Guid leagueId, Guid flagId);
}

public class V3MatchFlagService(
    ApiDbContext dbContext,
    IOrganizationService organizationService) : IV3MatchFlagService
{
    public async Task<MatchFlagResponse> CreateFlagAsync(Guid orgId, Guid leagueId, CreateMatchFlagRequest request)
    {
        var matchExists = await dbContext.Set<V3Match>()
            .AnyAsync(m => m.OrganizationId == orgId && m.LeagueId == leagueId && m.Id == request.MatchId);

        if (!matchExists)
            throw new NotFoundException("Match not found");

        var membershipId = await organizationService.GetCurrentMembershipIdAsync(orgId);

        var now = DateTimeOffset.UtcNow;
        var flag = new V3MatchFlag
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            MatchId = request.MatchId,
            FlaggedByMembershipId = membershipId,
            Reason = request.Reason,
            Status = MatchFlagStatus.Open,
            UpdatedAt = now,
        };

        dbContext.Set<V3MatchFlag>().Add(flag);

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
        {
            throw new InvalidArgumentException("You have already flagged this match");
        }

        return await LoadAndMapFlag(orgId, leagueId, flag.Id);
    }

    public async Task<List<MatchFlagResponse>> GetFlagsAsync(Guid orgId, Guid leagueId, MatchFlagStatus? status)
    {
        var query = dbContext.Set<V3MatchFlag>()
            .AsNoTracking()
            .Include(f => f.FlaggedByMembership)
            .Include(f => f.ResolvedByMembership)
            .Where(f => f.OrganizationId == orgId && f.LeagueId == leagueId);

        if (status.HasValue)
            query = query.Where(f => f.Status == status.Value);

        var flags = await query
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        return flags.Select(MapToResponse).ToList();
    }

    public async Task<MatchFlagResponse> GetFlagAsync(Guid orgId, Guid leagueId, Guid flagId)
    {
        return await LoadAndMapFlag(orgId, leagueId, flagId);
    }

    public async Task<MatchFlagResponse> ResolveFlagAsync(Guid orgId, Guid leagueId, Guid flagId, ResolveMatchFlagRequest request)
    {
        var flag = await dbContext.Set<V3MatchFlag>()
            .FirstOrDefaultAsync(f => f.OrganizationId == orgId && f.LeagueId == leagueId && f.Id == flagId);

        if (flag == null)
            throw new NotFoundException("Match flag not found");

        if (flag.Status != MatchFlagStatus.Open)
            throw new InvalidArgumentException("Flag is already resolved");

        var membershipId = await organizationService.GetCurrentMembershipIdAsync(orgId);

        flag.Status = request.Status;
        flag.ResolutionNote = request.ResolutionNote;
        flag.ResolvedByMembershipId = membershipId;
        flag.ResolvedAt = DateTimeOffset.UtcNow;
        flag.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync();

        return await LoadAndMapFlag(orgId, leagueId, flag.Id);
    }

    public async Task<List<MatchFlagResponse>> GetMyFlagsAsync(Guid orgId, Guid leagueId)
    {
        var membershipId = await organizationService.GetCurrentMembershipIdAsync(orgId);

        var flags = await dbContext.Set<V3MatchFlag>()
            .AsNoTracking()
            .Include(f => f.FlaggedByMembership)
            .Include(f => f.ResolvedByMembership)
            .Where(f => f.OrganizationId == orgId && f.LeagueId == leagueId
                && f.FlaggedByMembershipId == membershipId && f.Status == MatchFlagStatus.Open)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        return flags.Select(MapToResponse).ToList();
    }

    public async Task<MatchFlagResponse> UpdateFlagReasonAsync(Guid orgId, Guid leagueId, Guid flagId, UpdateMatchFlagReasonRequest request)
    {
        var flag = await dbContext.Set<V3MatchFlag>()
            .FirstOrDefaultAsync(f => f.OrganizationId == orgId && f.LeagueId == leagueId && f.Id == flagId);

        if (flag == null)
            throw new NotFoundException("Match flag not found");

        var membershipId = await organizationService.GetCurrentMembershipIdAsync(orgId);

        if (flag.FlaggedByMembershipId != membershipId)
            throw new ForbiddenException("You can only update your own flags");

        if (flag.Status != MatchFlagStatus.Open)
            throw new InvalidArgumentException("Cannot update a resolved flag");

        flag.Reason = request.Reason;
        flag.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync();

        return await LoadAndMapFlag(orgId, leagueId, flag.Id);
    }

    public async Task DeleteFlagAsync(Guid orgId, Guid leagueId, Guid flagId)
    {
        var flag = await dbContext.Set<V3MatchFlag>()
            .FirstOrDefaultAsync(f => f.OrganizationId == orgId && f.LeagueId == leagueId && f.Id == flagId);

        if (flag == null)
            throw new NotFoundException("Match flag not found");

        var membershipId = await organizationService.GetCurrentMembershipIdAsync(orgId);

        if (flag.FlaggedByMembershipId != membershipId)
            throw new ForbiddenException("You can only delete your own flags");

        if (flag.Status != MatchFlagStatus.Open)
            throw new InvalidArgumentException("Cannot delete a resolved flag");

        dbContext.Set<V3MatchFlag>().Remove(flag);
        await dbContext.SaveChangesAsync();
    }

    private async Task<MatchFlagResponse> LoadAndMapFlag(Guid orgId, Guid leagueId, Guid flagId)
    {
        var flag = await dbContext.Set<V3MatchFlag>()
            .Include(f => f.FlaggedByMembership)
            .Include(f => f.ResolvedByMembership)
            .FirstOrDefaultAsync(f => f.OrganizationId == orgId && f.LeagueId == leagueId && f.Id == flagId);

        if (flag == null)
            throw new NotFoundException("Match flag not found");

        return MapToResponse(flag);
    }

    private static MatchFlagResponse MapToResponse(V3MatchFlag flag)
    {
        return new MatchFlagResponse
        {
            Id = flag.Id,
            MatchId = flag.MatchId,
            FlaggedByMembershipId = flag.FlaggedByMembershipId,
            FlaggedByDisplayName = flag.FlaggedByMembership?.DisplayName,
            Reason = flag.Reason,
            Status = flag.Status,
            ResolutionNote = flag.ResolutionNote,
            ResolvedByMembershipId = flag.ResolvedByMembershipId,
            ResolvedByDisplayName = flag.ResolvedByMembership?.DisplayName,
            ResolvedAt = flag.ResolvedAt,
            CreatedAt = flag.CreatedAt,
            UpdatedAt = flag.UpdatedAt,
        };
    }
}
