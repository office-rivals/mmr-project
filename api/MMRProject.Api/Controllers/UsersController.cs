using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Mappers;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
public class UsersController(IUserService userService) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<UserDetails>> GetUsers()
    {
        var users = await userService.AllUsersAsync();
        return users.Select(UserMapper.MapUserToUserDetails);
    }

    [HttpPost]
    public async Task<UserDetails> CreateUser([FromBody, Required] CreateUserRequest request)
    {
        var user = await userService.CreateUserAsync(request.Name, request.DisplayName);
        return UserMapper.MapUserToUserDetails(user);
    }

    [HttpGet("search")]
    public async Task<IEnumerable<UserDetails>> SearchUser([FromQuery] string query)
    {
        var users = await userService.AllUsersAsync(query);
        return users.Select(UserMapper.MapUserToUserDetails);
    }

    [HttpGet("{userId:long}")]
    public async Task<ActionResult<UserDetails>> GetUser(long userId)
    {
        var user = await userService.GetUserAsync(userId);
        if (user is null)
        {
            return NotFound("User not found");
        }

        return UserMapper.MapUserToUserDetails(user);
    }
}