using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Authorization;

public class RoleClaimsTransformation(
    ApiDbContext context,
    IMemoryCache cache,
    ILogger<RoleClaimsTransformation> logger)
    : IClaimsTransformation
{
    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
            return principal;

        var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? principal.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userId))
            return principal;

        var cacheKey = $"player_role:{userId}";

        if (!cache.TryGetValue(cacheKey, out PlayerRole role))
        {
            var player = await context.Players
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdentityUserId == userId);

            if (player != null)
            {
                role = player.Role;
                var cacheOptions = new MemoryCacheEntryOptions()
                    .SetSlidingExpiration(TimeSpan.FromMinutes(5));
                cache.Set(cacheKey, role, cacheOptions);
                logger.LogInformation("Cached role {Role} for user {UserId} (player ID: {PlayerId})", role, userId, player.Id);
            }
            else
            {
                role = PlayerRole.User;
                logger.LogWarning("Player not found for user {UserId}, defaulting to User role", userId);
            }
        }
        else
        {
            logger.LogDebug("Using cached role {Role} for user {UserId}", role, userId);
        }

        if (principal.Identity is ClaimsIdentity identity)
        {
            var existingRoleClaims = identity.FindAll("player_role").ToList();
            foreach (var claim in existingRoleClaims)
            {
                identity.RemoveClaim(claim);
            }

            identity.AddClaim(new Claim("player_role", role.ToString()));
        }

        return principal;
    }
}
