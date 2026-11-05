using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

/// <summary>
/// Shared-link entry points. Organization and league are resolved from the share code
/// and eligibility is checked server-side, so these routes work for users who are not yet members.
/// </summary>
[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/game-invites")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.DenyPatAuthentication)]
public class GameInviteLinksController(IGameInviteService gameInviteService) : ControllerBase
{
    [HttpGet("{shareCode}")]
    public async Task<ActionResult<GameInviteLinkResponse>> GetByShareCode([FromRoute] string shareCode)
    {
        return await gameInviteService.GetInviteByShareCodeAsync(shareCode);
    }

    [HttpPost("{shareCode}/join")]
    public async Task<ActionResult<GameInviteResponse>> Join([FromRoute] string shareCode)
    {
        return await gameInviteService.JoinByShareCodeAsync(shareCode);
    }
}
