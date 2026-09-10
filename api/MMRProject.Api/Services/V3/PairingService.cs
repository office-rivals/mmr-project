using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface IPairingService
{
    Task<PairingCodeResponse> IssuePairingCodeAsync();
    Task<List<RfidTagResponse>> ListTagsAsync();
    Task UnlinkTagAsync(Guid tagId);
    Task<PairingSubmitResponse> SubmitPairingAsync(PairingSubmitRequest request);
}

public class PairingService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    ILogger<PairingService> logger)
    : IPairingService
{
    private const int CodeLength = 4;
    private const int MaxGenerationAttempts = 10;
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromHours(24);

    public async Task<PairingCodeResponse> IssuePairingCodeAsync()
    {
        var user = await GetCurrentUserAsync();
        var now = DateTimeOffset.UtcNow;

        var existing = await dbContext.PairingCodes
            .Where(c => c.UserId == user.Id && c.UsedAt == null && c.ExpiresAt > now)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            return MapToResponse(existing);
        }

        var code = await GenerateUniqueCodeAsync(now);

        var pairingCode = new PairingCode
        {
            UserId = user.Id,
            Code = code,
            ExpiresAt = now + CodeLifetime,
        };

        dbContext.PairingCodes.Add(pairingCode);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Issued pairing code for user {UserId}", user.Id);

        return MapToResponse(pairingCode);
    }

    public async Task<List<RfidTagResponse>> ListTagsAsync()
    {
        var user = await GetCurrentUserAsync();

        var tags = await dbContext.RfidTags
            .Where(t => t.UserId == user.Id)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        return tags.Select(t => new RfidTagResponse
        {
            Id = t.Id,
            RfidUid = t.RfidUid,
            CreatedAt = t.CreatedAt,
        }).ToList();
    }

    public async Task UnlinkTagAsync(Guid tagId)
    {
        var user = await GetCurrentUserAsync();

        var tag = await dbContext.RfidTags
            .FirstOrDefaultAsync(t => t.Id == tagId && t.UserId == user.Id);

        if (tag == null)
            throw new NotFoundException("Tag not found");

        dbContext.RfidTags.Remove(tag);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Unlinked tag {TagId} from user {UserId}", tagId, user.Id);
    }

    public async Task<PairingSubmitResponse> SubmitPairingAsync(PairingSubmitRequest request)
    {
        var now = DateTimeOffset.UtcNow;
        var code = FormatCode(request.Colors);

        var pairingCode = await dbContext.PairingCodes
            .FirstOrDefaultAsync(c => c.Code == code && c.UsedAt == null && c.ExpiresAt > now);

        if (pairingCode == null)
        {
            logger.LogInformation("Pairing submit rejected: no active code matched");
            return new PairingSubmitResponse { Success = false };
        }

        var existingTag = await dbContext.RfidTags
            .FirstOrDefaultAsync(t => t.RfidUid == request.RfidUid);

        if (existingTag != null && existingTag.UserId != pairingCode.UserId)
        {
            logger.LogInformation("Pairing submit rejected: tag {RfidUid} already paired to another user", request.RfidUid);
            return new PairingSubmitResponse { Success = false };
        }

        if (existingTag == null)
        {
            dbContext.RfidTags.Add(new RfidTag { UserId = pairingCode.UserId, RfidUid = request.RfidUid });
        }

        pairingCode.UsedAt = now;
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Paired tag {RfidUid} to user {UserId}", request.RfidUid, pairingCode.UserId);

        return new PairingSubmitResponse { Success = true };
    }

    private async Task<string> GenerateUniqueCodeAsync(DateTimeOffset now)
    {
        for (var attempt = 0; attempt < MaxGenerationAttempts; attempt++)
        {
            var code = GenerateRandomCode();

            var collides = await dbContext.PairingCodes
                .AnyAsync(c => c.Code == code && c.UsedAt == null && c.ExpiresAt > now);

            if (!collides)
                return code;
        }

        throw new InvalidOperationException("Could not generate a unique pairing code");
    }

    private static string GenerateRandomCode()
    {
        var colors = Enum.GetValues<PairingColor>();
        var sequence = new PairingColor[CodeLength];
        for (var i = 0; i < CodeLength; i++)
        {
            sequence[i] = colors[Random.Shared.Next(colors.Length)];
        }

        return FormatCode(sequence);
    }

    private static string FormatCode(IEnumerable<PairingColor> colors)
    {
        return string.Join(",", colors);
    }

    private static PairingCodeResponse MapToResponse(PairingCode pairingCode)
    {
        return new PairingCodeResponse
        {
            Colors = pairingCode.Code.Split(',').Select(Enum.Parse<PairingColor>).ToList(),
            ExpiresAt = pairingCode.ExpiresAt,
        };
    }

    private async Task<User> GetCurrentUserAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (user == null)
            throw new InvalidOperationException("User not found");

        return user;
    }
}
