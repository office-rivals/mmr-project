using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface IV3PersonalAccessTokenService
{
    Task<CreateTokenResponse> GenerateTokenAsync(CreateTokenRequest request);
    Task<List<TokenResponse>> ListTokensAsync();
    Task RevokeTokenAsync(Guid tokenId);
    Task<V3PersonalAccessToken?> ValidateTokenAsync(string token);
}

public class V3PersonalAccessTokenService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    ILogger<V3PersonalAccessTokenService> logger)
    : IV3PersonalAccessTokenService
{
    public async Task<CreateTokenResponse> GenerateTokenAsync(CreateTokenRequest request)
    {
        var user = await GetCurrentUserAsync();

        var plainTextToken = GenerateRandomToken();
        var tokenHash = HashToken(plainTextToken);

        var pat = new V3PersonalAccessToken
        {
            UserId = user.Id,
            OrganizationId = request.OrganizationId,
            LeagueId = request.LeagueId,
            Scope = request.Scope,
            TokenHash = tokenHash,
            Name = request.Name,
            ExpiresAt = request.ExpiresAt,
        };

        dbContext.V3PersonalAccessTokens.Add(pat);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Generated PAT {TokenId} for user {UserId}", pat.Id, user.Id);

        return new CreateTokenResponse
        {
            Token = plainTextToken,
            TokenDetails = MapToResponse(pat),
        };
    }

    public async Task<List<TokenResponse>> ListTokensAsync()
    {
        var user = await GetCurrentUserAsync();

        var tokens = await dbContext.V3PersonalAccessTokens
            .Where(t => t.UserId == user.Id)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        return tokens.Select(MapToResponse).ToList();
    }

    public async Task RevokeTokenAsync(Guid tokenId)
    {
        var user = await GetCurrentUserAsync();

        var token = await dbContext.V3PersonalAccessTokens
            .FirstOrDefaultAsync(t => t.Id == tokenId && t.UserId == user.Id);

        if (token == null)
        {
            throw new InvalidOperationException("Token not found or does not belong to user");
        }

        dbContext.V3PersonalAccessTokens.Remove(token);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Revoked PAT {TokenId} for user {UserId}", tokenId, user.Id);
    }

    public async Task<V3PersonalAccessToken?> ValidateTokenAsync(string token)
    {
        var tokenHash = HashToken(token);

        var pat = await dbContext.V3PersonalAccessTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (pat == null)
        {
            var truncatedHash = Convert.ToHexString(tokenHash)[..8];
            logger.LogInformation("Token with hash prefix {TokenHashPrefix} not found", truncatedHash);
            return null;
        }

        if (pat.ExpiresAt.HasValue && pat.ExpiresAt.Value < DateTimeOffset.UtcNow)
        {
            logger.LogInformation("Token {TokenId} expired", pat.Id);
            return null;
        }

        pat.LastUsedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync();

        return pat;
    }

    private async Task<User> GetCurrentUserAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (user == null)
        {
            throw new InvalidOperationException("User not found");
        }

        return user;
    }

    private static TokenResponse MapToResponse(V3PersonalAccessToken pat)
    {
        return new TokenResponse
        {
            Id = pat.Id,
            Name = pat.Name,
            Scope = pat.Scope,
            OrganizationId = pat.OrganizationId,
            LeagueId = pat.LeagueId,
            LastUsedAt = pat.LastUsedAt,
            ExpiresAt = pat.ExpiresAt,
            CreatedAt = pat.CreatedAt,
        };
    }

    private static string GenerateRandomToken()
    {
        var randomBytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return $"pat_{Convert.ToHexString(randomBytes).ToLowerInvariant()}";
    }

    private static byte[] HashToken(string token)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(token));
    }
}
