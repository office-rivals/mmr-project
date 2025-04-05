using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Mappers;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/profile")]
public class ProfileController(IUserService userService) : ControllerBase
{
    [HttpGet]
    public async Task<ProfileDetails> GetProfile()
    {
        var user = await userService.GetCurrentAuthenticatedUserAsync();

        var userId = user?.Id;

        if (userId is null)
        {
            throw new UnauthorizedAccessException("User not found");
        }

        return new ProfileDetails
        {
            UserId = userId,
            ColorCode = ColorCodeHelper.ConvertIntIdToBase4(Convert.ToInt32(userId))
        };
    }

    [HttpPost("claim")]
    public async Task<ProfileDetails> ClaimProfile([FromBody, Required] ClaimProfileRequest request)
    {
        var user = await userService.ClaimUserForCurrentAuthenticatedUserAsync(request.UserId);
        return new ProfileDetails { UserId = user.Id };
    }
}
