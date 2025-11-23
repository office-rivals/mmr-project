using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/match-flags")]
[Authorize(Policy = AuthorizationPolicies.RequireUserRole)]
public class MatchFlagsController(
    IMatchFlagService matchFlagService,
    IUserService userService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<UserMatchFlag>> CreateFlag([FromBody] CreateMatchFlagRequest request)
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized();
        }

        var flag = await matchFlagService.CreateFlagAsync(request.MatchId, currentUser.Id, request.Reason);

        return Ok(new UserMatchFlag
        {
            Id = flag.Id,
            MatchId = flag.MatchId,
            Reason = flag.Reason,
            CreatedAt = flag.CreatedAt
        });
    }

    [HttpGet("me")]
    public async Task<ActionResult<List<UserMatchFlag>>> GetMyPendingFlags()
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized();
        }

        var flags = await matchFlagService.GetUserPendingFlagsAsync(currentUser.Id);

        var userFlags = flags.Select(f => new UserMatchFlag
        {
            Id = f.Id,
            MatchId = f.MatchId,
            Reason = f.Reason,
            CreatedAt = f.CreatedAt
        }).ToList();

        return Ok(userFlags);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserMatchFlag>> UpdateFlag(long id, [FromBody] UpdateMatchFlagReasonRequest request)
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized();
        }

        var flag = await matchFlagService.UpdateFlagReasonAsync(id, currentUser.Id, request.Reason);

        return Ok(new UserMatchFlag
        {
            Id = flag.Id,
            MatchId = flag.MatchId,
            Reason = flag.Reason,
            CreatedAt = flag.CreatedAt
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteFlag(long id)
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized();
        }

        await matchFlagService.DeleteFlagAsync(id, currentUser.Id);

        return NoContent();
    }
}
