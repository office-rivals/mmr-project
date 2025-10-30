using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/roles")]
public class RolesController(IRoleService roleService) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<PlayerRoleResponse>> GetMyRole()
    {
        var role = await roleService.GetCurrentUserRoleAsync();
        return Ok(new PlayerRoleResponse { Role = role });
    }

    [HttpGet("player/{playerId}")]
    [Authorize(Policy = AuthorizationPolicies.RequireModeratorRole)]
    public async Task<ActionResult<PlayerRoleResponse>> GetPlayerRole(long playerId)
    {
        var role = await roleService.GetPlayerRoleAsync(playerId);
        return Ok(new PlayerRoleResponse { Role = role });
    }

    [HttpPost("assign")]
    [Authorize(Policy = AuthorizationPolicies.RequireOwnerRole)]
    public async Task<IActionResult> AssignRole([FromBody] AssignRoleRequest request)
    {
        await roleService.AssignRoleAsync(request.PlayerId, request.Role);
        return Ok();
    }
}

public record PlayerRoleResponse
{
    public PlayerRole Role { get; init; }
}

public record AssignRoleRequest
{
    public long PlayerId { get; init; }
    public PlayerRole Role { get; init; }
}
