using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Services.V3;

public interface IV3UserService
{
    Task<User> EnsureUserAsync(string identityUserId, string email, string? username, string? displayName);
    Task<User?> GetByIdentityUserIdAsync(string identityUserId);
}

public class V3UserService(ApiDbContext dbContext) : IV3UserService
{
    public async Task<User> EnsureUserAsync(string identityUserId, string email, string? username, string? displayName)
    {
        var user = await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (user != null)
        {
            var updated = false;

            if (user.Email != email)
            {
                user.Email = email;
                updated = true;
            }

            if (username != null && user.Username != username)
            {
                user.Username = username;
                updated = true;
            }

            if (displayName != null && user.DisplayName != displayName)
            {
                user.DisplayName = displayName;
                updated = true;
            }

            if (updated)
            {
                await dbContext.SaveChangesAsync();
            }

            return user;
        }

        user = new User
        {
            IdentityUserId = identityUserId,
            Email = email,
            Username = username,
            DisplayName = displayName
        };

        dbContext.V3Users.Add(user);

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            dbContext.ChangeTracker.Clear();
            return await dbContext.V3Users
                .FirstAsync(u => u.IdentityUserId == identityUserId);
        }

        return user;
    }

    public async Task<User?> GetByIdentityUserIdAsync(string identityUserId)
    {
        return await dbContext.V3Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);
    }
}
