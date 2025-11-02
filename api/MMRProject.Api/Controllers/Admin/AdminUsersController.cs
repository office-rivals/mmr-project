using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.DTOs;
using MMRProject.Api.DTOs.Admin;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/users")]
[Authorize(Policy = AuthorizationPolicies.RequireModeratorRole)]
public class AdminUsersController(IUserService userService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminUserDetailsResponse>>> GetUsers()
    {
        var users = await userService.AllUsersAsync();
        return Ok(users.Select(user => new AdminUserDetailsResponse
        {
            Id = user.Id,
            IdentityUserId = user.IdentityUserId,
            Email = user.Email,
            Name = user.Name,
            DisplayName = user.DisplayName,
            Mmr = user.Mmr,
            Sigma = user.Sigma,
            Role = user.Role,
            RoleAssignedById = user.RoleAssignedById,
            RoleAssignedAt = user.RoleAssignedAt,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            DeletedAt = user.DeletedAt
        }));
    }

    [HttpGet("{userId:long}")]
    public async Task<ActionResult<AdminUserDetailsResponse>> GetUser(long userId)
    {
        var user = await userService.GetUserAsync(userId);
        if (user is null)
        {
            return NotFound($"User with ID {userId} not found");
        }

        return Ok(new AdminUserDetailsResponse
        {
            Id = user.Id,
            IdentityUserId = user.IdentityUserId,
            Email = user.Email,
            Name = user.Name,
            DisplayName = user.DisplayName,
            Mmr = user.Mmr,
            Sigma = user.Sigma,
            Role = user.Role,
            RoleAssignedById = user.RoleAssignedById,
            RoleAssignedAt = user.RoleAssignedAt,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            DeletedAt = user.DeletedAt
        });
    }

    [HttpPatch("{userId:long}")]
    public async Task<ActionResult<AdminUserDetailsResponse>> UpdateUser(
        long userId,
        [FromBody, Required] UpdateUserRequest request)
    {
        var user = await userService.UpdateUserAsync(userId, request.Name, request.DisplayName, request.Role);

        return Ok(new AdminUserDetailsResponse
        {
            Id = user.Id,
            IdentityUserId = user.IdentityUserId,
            Email = user.Email,
            Name = user.Name,
            DisplayName = user.DisplayName,
            Mmr = user.Mmr,
            Sigma = user.Sigma,
            Role = user.Role,
            RoleAssignedById = user.RoleAssignedById,
            RoleAssignedAt = user.RoleAssignedAt,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            DeletedAt = user.DeletedAt
        });
    }
}