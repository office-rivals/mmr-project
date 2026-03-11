using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Services.Adapters;

public class PersonalAccessTokenServiceAdapter(
    ILegacyIdResolver idResolver,
    IV3PersonalAccessTokenService tokenService) : IPersonalAccessTokenService
{
    public async Task<(PersonalAccessToken token, string plainTextToken)> GenerateTokenForPlayerAsync(
        long playerId, string name, DateTimeOffset? expiresAt)
    {
        var request = new CreateTokenRequest
        {
            Name = name,
            Scope = "legacy",
            ExpiresAt = expiresAt,
        };

        var result = await tokenService.GenerateTokenAsync(request);

        var legacyToken = new PersonalAccessToken
        {
            Name = result.TokenDetails.Name,
            ExpiresAt = result.TokenDetails.ExpiresAt?.UtcDateTime,
            CreatedAt = result.TokenDetails.CreatedAt.UtcDateTime,
        };

        return (legacyToken, result.Token);
    }

    public async Task RevokeTokenAsync(long tokenId, long playerId)
    {
        // V3 tokens use Guid IDs. This is a best-effort mapping.
        // In practice, legacy token IDs won't map to v3 tokens.
        throw new NotSupportedException("Token revocation by legacy ID is not supported through the adapter");
    }

    public async Task<List<PersonalAccessToken>> ListTokensForPlayerAsync(long playerId)
    {
        var tokens = await tokenService.ListTokensAsync();

        return tokens.Select(t => new PersonalAccessToken
        {
            Name = t.Name,
            LastUsedAt = t.LastUsedAt?.UtcDateTime,
            ExpiresAt = t.ExpiresAt?.UtcDateTime,
            CreatedAt = t.CreatedAt.UtcDateTime,
        }).ToList();
    }

    public async Task<PersonalAccessToken?> UseTokenAsync(string token)
    {
        var v3Token = await tokenService.ValidateTokenAsync(token);
        if (v3Token == null)
            return null;

        return new PersonalAccessToken
        {
            Name = v3Token.Name,
            LastUsedAt = v3Token.LastUsedAt?.UtcDateTime,
            ExpiresAt = v3Token.ExpiresAt?.UtcDateTime,
            CreatedAt = v3Token.CreatedAt.UtcDateTime,
            Player = v3Token.User?.LegacyPlayerId != null
                ? new Player { Id = v3Token.User.LegacyPlayerId.Value }
                : null,
        };
    }
}
