using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;

namespace MMRProject.Api.Mappers;

public static class UserMapper
{
    public static UserDetails MapUserToUserDetails(Player player)
    {
        return new UserDetails
        {
            UserId = player.Id,
            Name = player.Name ?? string.Empty, // TODO: Fix this
            DisplayName = player.DisplayName
        };
    }
}