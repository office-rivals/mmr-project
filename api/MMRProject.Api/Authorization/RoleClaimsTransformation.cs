using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Authorization;

public class RoleClaimsTransformation : IClaimsTransformation
{
    private readonly ApiDbContext _context;
    private readonly IMemoryCache _cache;
    private readonly ILogger<RoleClaimsTransformation> _logger;

    public RoleClaimsTransformation(
        ApiDbContext context,
        IMemoryCache cache,
        ILogger<RoleClaimsTransformation> logger)
    {
        _context = context;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
            return principal;

        if (principal.FindFirst("player_role") != null)
            return principal;

        var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? principal.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userId))
            return principal;

        var cacheKey = $"player_role:{userId}";

        if (!_cache.TryGetValue(cacheKey, out PlayerRole role))
        {
            var player = await _context.Players
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdentityUserId == userId);

            if (player != null)
            {
                role = player.Role;
                var cacheOptions = new MemoryCacheEntryOptions()
                    .SetSlidingExpiration(TimeSpan.FromMinutes(5));
                _cache.Set(cacheKey, role, cacheOptions);
                _logger.LogDebug("Cached role {Role} for user {UserId}", role, userId);
            }
            else
            {
                role = PlayerRole.User;
            }
        }

        var identity = (ClaimsIdentity)principal.Identity;
        identity.AddClaim(new Claim("player_role", role.ToString()));

        return principal;
    }
}
