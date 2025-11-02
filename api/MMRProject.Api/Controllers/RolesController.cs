using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
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
}
