using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;

namespace MMRProject.Api.Services.V3;

public interface ILeagueService
{
    Task<LeagueResponse> CreateLeagueAsync(Guid orgId, CreateLeagueRequest request);
    Task<LeagueResponse> GetLeagueAsync(Guid orgId, Guid leagueId);
    Task<LeagueResponse?> GetLeagueBySlugAsync(Guid orgId, string slug);
    Task<List<LeagueResponse>> ListLeaguesAsync(Guid orgId);
    Task<LeagueResponse> UpdateLeagueAsync(Guid orgId, Guid leagueId, UpdateLeagueRequest request);
}

public class LeagueService(ApiDbContext dbContext) : ILeagueService
{
    public async Task<LeagueResponse> CreateLeagueAsync(Guid orgId, CreateLeagueRequest request)
    {
        var existingLeague = await dbContext.Leagues
            .FirstOrDefaultAsync(l => l.OrganizationId == orgId && l.Slug == request.Slug);

        if (existingLeague != null)
            throw new InvalidArgumentException($"A league with slug '{request.Slug}' already exists in this organization");

        var league = new League
        {
            OrganizationId = orgId,
            Name = request.Name,
            Slug = request.Slug,
            QueueSize = request.QueueSize
        };

        dbContext.Leagues.Add(league);
        await dbContext.SaveChangesAsync();

        return MapToResponse(league);
    }

    public async Task<LeagueResponse> GetLeagueAsync(Guid orgId, Guid leagueId)
    {
        var league = await dbContext.Leagues
            .FirstOrDefaultAsync(l => l.Id == leagueId && l.OrganizationId == orgId)
            ?? throw new NotFoundException($"League with ID '{leagueId}' not found");

        return MapToResponse(league);
    }

    public async Task<LeagueResponse?> GetLeagueBySlugAsync(Guid orgId, string slug)
    {
        var league = await dbContext.Leagues
            .FirstOrDefaultAsync(l => l.OrganizationId == orgId && l.Slug == slug);

        return league == null ? null : MapToResponse(league);
    }

    public async Task<List<LeagueResponse>> ListLeaguesAsync(Guid orgId)
    {
        var leagues = await dbContext.Leagues
            .Where(l => l.OrganizationId == orgId)
            .OrderBy(l => l.Name)
            .ToListAsync();

        return leagues.Select(MapToResponse).ToList();
    }

    public async Task<LeagueResponse> UpdateLeagueAsync(Guid orgId, Guid leagueId, UpdateLeagueRequest request)
    {
        var league = await dbContext.Leagues
            .FirstOrDefaultAsync(l => l.Id == leagueId && l.OrganizationId == orgId)
            ?? throw new NotFoundException($"League with ID '{leagueId}' not found");

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                throw new InvalidArgumentException("Name cannot be empty");
            league.Name = request.Name;
        }

        if (request.Slug != null)
        {
            if (string.IsNullOrWhiteSpace(request.Slug))
                throw new InvalidArgumentException("Slug cannot be empty");

            var existingLeague = await dbContext.Leagues
                .FirstOrDefaultAsync(l => l.OrganizationId == orgId && l.Slug == request.Slug && l.Id != leagueId);

            if (existingLeague != null)
                throw new InvalidArgumentException($"A league with slug '{request.Slug}' already exists in this organization");

            league.Slug = request.Slug;
        }

        if (request.QueueSize.HasValue)
        {
            if (request.QueueSize.Value < 2)
                throw new InvalidArgumentException("Queue size must be at least 2");
            league.QueueSize = request.QueueSize.Value;
        }

        await dbContext.SaveChangesAsync();

        return MapToResponse(league);
    }

    private static LeagueResponse MapToResponse(League league)
    {
        return new LeagueResponse
        {
            Id = league.Id,
            OrganizationId = league.OrganizationId,
            Name = league.Name,
            Slug = league.Slug,
            QueueSize = league.QueueSize,
            CreatedAt = league.CreatedAt
        };
    }
}
