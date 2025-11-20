using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/match-flags")]
[Authorize(Policy = AuthorizationPolicies.RequireModeratorRole)]
public class AdminMatchFlagsController(
    IMatchFlagService matchFlagService,
    IUserService userService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<MatchFlagDetails>>> GetPendingFlags()
    {
        var flags = await matchFlagService.GetPendingFlagsAsync();
        return Ok(flags);
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> UpdateFlag(long id, [FromBody] UpdateMatchFlagRequest request)
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized();
        }

        var flag = await matchFlagService.ResolveFlagAsync(id, currentUser.Id, request.Note);
        return Ok(flag);
    }
}
