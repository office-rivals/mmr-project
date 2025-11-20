using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/matches")]
public class MatchesController(
    IMatchFlagService matchFlagService,
    IUserService userService) : ControllerBase
{
    [HttpPost("{matchId}/flags")]
    [Authorize(Policy = AuthorizationPolicies.RequireUserRole)]
    public async Task<IActionResult> CreateFlag(long matchId, [FromBody] CreateMatchFlagRequest request)
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized();
        }

        var flag = await matchFlagService.CreateFlagAsync(matchId, currentUser.Id, request.Reason);
        return Ok(flag);
    }
}
