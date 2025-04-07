using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;

namespace MMRProject.Api.Mappers;

public static class UserMapper
{
    public static UserDetails MapUserToUserDetails(User user)
    {
        return new UserDetails
        {
            UserId = user.Id,
            Name = user.Name ?? string.Empty, // TODO: Fix this
            DisplayName = user.DisplayName
        };
    }
}