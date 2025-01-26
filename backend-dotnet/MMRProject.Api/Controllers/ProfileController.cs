using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Extensions;
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
        return new ProfileDetails { UserId = user?.Id };
    }
    
    [HttpGet("permissions")]
    public async Task<ProfilePermissionsDto> GetProfilePermissions()
    {
        var user = await userService.GetCurrentAuthenticatedUserAsync();
        return new ProfilePermissionsDto { IsAdmin = user?.IsAdmin.NullIfFalse()  };
    }

    [HttpPost("claim")]
    public async Task<ProfileDetails> ClaimProfile([FromBody, Required] ClaimProfileRequest request)
    {
        var user = await userService.ClaimUserForCurrentAuthenticatedUserAsync(request.UserId);
        return new ProfileDetails { UserId = user.Id };
    }
}