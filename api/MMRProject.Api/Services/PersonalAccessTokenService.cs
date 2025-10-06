using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Services;

public interface IPersonalAccessTokenService
{
    Task<(PersonalAccessToken token, string plainTextToken)> GenerateTokenForPlayerAsync(
        long playerId,
        string name,
        DateTimeOffset? expiresAt
    );

    Task RevokeTokenAsync(long tokenId, long playerId);
    Task<List<PersonalAccessToken>> ListTokensForPlayerAsync(long playerId);
    Task<PersonalAccessToken?> UseTokenAsync(string token);
}

public class PersonalAccessTokenService(ApiDbContext dbContext, ILogger<PersonalAccessTokenService> logger)
    : IPersonalAccessTokenService
{
    public async Task<(PersonalAccessToken token, string plainTextToken)> GenerateTokenForPlayerAsync(
        long playerId,
        string name,
        DateTimeOffset? expiresAt
    )
    {
        var plainTextToken = GenerateRandomToken();
        var tokenHash = HashToken(plainTextToken);

        var token = new PersonalAccessToken
        {
            PlayerId = playerId,
            TokenHash = tokenHash,
            Name = name,
            ExpiresAt = expiresAt?.UtcDateTime,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.PersonalAccessTokens.Add(token);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Generated PAT {TokenId} for player {PlayerId}", token.Id, playerId);

        return (token, plainTextToken);
    }

    public async Task RevokeTokenAsync(long tokenId, long playerId)
    {
        var token = await dbContext.PersonalAccessTokens
            .FirstOrDefaultAsync(t => t.Id == tokenId && t.PlayerId == playerId);

        if (token == null)
        {
            throw new InvalidOperationException("Token not found or does not belong to player");
        }

        dbContext.PersonalAccessTokens.Remove(token);

        await dbContext.SaveChangesAsync();

        logger.LogInformation("Revoked PAT {TokenId} for player {PlayerId}", tokenId, playerId);
    }

    public async Task<List<PersonalAccessToken>> ListTokensForPlayerAsync(long playerId)
    {
        return await dbContext.PersonalAccessTokens
            .Where(t => t.PlayerId == playerId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<PersonalAccessToken?> UseTokenAsync(string token)
    {
        var tokenHash = HashToken(token);
        var personalAccessToken = await dbContext.PersonalAccessTokens
            .Include(p => p.Player)
            .FirstOrDefaultAsync(p => p.TokenHash == tokenHash);

        if (personalAccessToken == null)
        {
            logger.LogInformation("Token {TokenHash} not found", tokenHash);
            return null;
        }

        if (personalAccessToken.ExpiresAt.HasValue && personalAccessToken.ExpiresAt.Value < DateTime.UtcNow)
        {
            logger.LogInformation("Token {TokenId} expired", personalAccessToken.Id);
            return null;
        }

        personalAccessToken.LastUsedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        return personalAccessToken;
    }

    private static string GenerateRandomToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        var randomString = Base64UrlEncoder.Encode(randomBytes);
        return $"pat_{randomString}";
    }

    private static byte[] HashToken(string token)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(token));
    }
}