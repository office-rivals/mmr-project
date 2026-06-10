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

        ValidateTeamSize(request.TeamSize);
        ValidateWinningScore(request.WinningScore);

        var league = new League
        {
            OrganizationId = orgId,
            Name = request.Name,
            Slug = request.Slug,
            TeamSize = request.TeamSize,
            WinningScore = request.WinningScore
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

        if (request.TeamSize.HasValue)
        {
            ValidateTeamSize(request.TeamSize.Value);
            league.TeamSize = request.TeamSize.Value;
        }

        if (request.UpdateWinningScore)
        {
            ValidateWinningScore(request.WinningScore);
            league.WinningScore = request.WinningScore;
        }

        await dbContext.SaveChangesAsync();

        return MapToResponse(league);
    }

    // Capped at the submit form's current 1v1/2v2 support. Lift this when the
    // submit form learns to render >2 player slots per team.
    private const int MaxSupportedTeamSize = 2;

    private static void ValidateTeamSize(int teamSize)
    {
        if (teamSize < 1 || teamSize > MaxSupportedTeamSize)
            throw new InvalidArgumentException($"Team size must be between 1 and {MaxSupportedTeamSize}");
    }

    // Sanity ceiling, well above the longest racket-sport set anyone would seed
    // here. Shared with match submission so free-form scores get the same cap.
    internal const int MaxWinningScore = 255;

    // Null = free-form scoring; otherwise the winning team must end at exactly this score.
    private static void ValidateWinningScore(int? winningScore)
    {
        if (winningScore is null) return;
        if (winningScore < 1 || winningScore > MaxWinningScore)
            throw new InvalidArgumentException($"Winning score must be between 1 and {MaxWinningScore}, or null for free-form scoring");
    }

    private static LeagueResponse MapToResponse(League league)
    {
        return new LeagueResponse
        {
            Id = league.Id,
            OrganizationId = league.OrganizationId,
            Name = league.Name,
            Slug = league.Slug,
            TeamSize = league.TeamSize,
            WinningScore = league.WinningScore,
            CreatedAt = league.CreatedAt
        };
    }
}
