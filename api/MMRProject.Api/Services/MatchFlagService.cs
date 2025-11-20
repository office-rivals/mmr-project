using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Mappers;

namespace MMRProject.Api.Services;

public interface IMatchFlagService
{
    Task<MatchFlag> CreateFlagAsync(long matchId, long playerId, string reason);
    Task<List<MatchFlagDetails>> GetPendingFlagsAsync();
    Task<MatchFlag> ResolveFlagAsync(long flagId, long resolvedById, string? note);
}

public class MatchFlagService(
    ApiDbContext dbContext,
    ILogger<MatchFlagService> logger) : IMatchFlagService
{
    public async Task<MatchFlag> CreateFlagAsync(long matchId, long playerId, string reason)
    {
        var match = await dbContext.Matches.FindAsync(matchId);
        if (match == null)
        {
            throw new InvalidArgumentException("Match not found");
        }

        var existingFlag = await dbContext.MatchFlags
            .Where(f => f.MatchId == matchId && f.FlaggedById == playerId && f.Status == MatchFlagStatus.Pending)
            .FirstOrDefaultAsync();

        if (existingFlag != null)
        {
            throw new InvalidArgumentException("You have already flagged this match");
        }

        var flag = new MatchFlag
        {
            MatchId = matchId,
            FlaggedById = playerId,
            Reason = reason,
            Status = MatchFlagStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.MatchFlags.Add(flag);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Match {MatchId} flagged by player {PlayerId}", matchId, playerId);

        return flag;
    }

    public async Task<List<MatchFlagDetails>> GetPendingFlagsAsync()
    {
        var flags = await dbContext.MatchFlags
            .Include(f => f.Match)
                .ThenInclude(m => m.TeamOne)
            .Include(f => f.Match)
                .ThenInclude(m => m.TeamTwo)
            .Include(f => f.Match)
                .ThenInclude(m => m.MmrCalculations)
            .Include(f => f.FlaggedBy)
            .Include(f => f.ResolvedBy)
            .Where(f => f.Status == MatchFlagStatus.Pending)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        var flagDetails = new List<MatchFlagDetails>();

        foreach (var flag in flags)
        {
            var matchDetails = MatchMapper.MapMatchToMatchDetails(flag.Match);
            if (matchDetails == null)
            {
                logger.LogWarning("Could not map match {MatchId} to MatchDetailsV2", flag.MatchId);
                continue;
            }

            if (flag.FlaggedBy == null || flag.FlaggedBy.Name == null)
            {
                logger.LogWarning("Flag {FlagId} has no FlaggedBy player or player name", flag.Id);
                continue;
            }

            flagDetails.Add(new MatchFlagDetails
            {
                Id = flag.Id,
                MatchId = flag.MatchId,
                Match = matchDetails,
                Reason = flag.Reason,
                FlaggedByName = flag.FlaggedBy.Name,
                FlaggedById = flag.FlaggedById,
                CreatedAt = flag.CreatedAt,
                Status = flag.Status,
                ResolutionNote = flag.ResolutionNote,
                ResolvedByName = flag.ResolvedBy?.Name,
                ResolvedAt = flag.ResolvedAt
            });
        }

        return flagDetails;
    }

    public async Task<MatchFlag> ResolveFlagAsync(long flagId, long resolvedById, string? note)
    {
        var flag = await dbContext.MatchFlags.FindAsync(flagId);
        if (flag == null)
        {
            throw new InvalidArgumentException("Flag not found");
        }

        if (flag.Status == MatchFlagStatus.Resolved)
        {
            logger.LogWarning("Flag {FlagId} is already resolved", flagId);
        }

        flag.Status = MatchFlagStatus.Resolved;
        flag.ResolvedById = resolvedById;
        flag.ResolvedAt = DateTime.UtcNow;
        flag.ResolutionNote = note;
        flag.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        logger.LogInformation("Flag {FlagId} resolved by player {PlayerId}", flagId, resolvedById);

        return flag;
    }
}
