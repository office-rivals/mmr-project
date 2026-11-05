using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/game-invites")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class GameInvitesController(IGameInviteService gameInviteService) : ControllerBase
{
    /// <summary>The game invite the caller is currently part of, if any.</summary>
    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<CurrentGameInviteResponse>> GetCurrentInvite(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return await gameInviteService.GetCurrentInviteAsync(orgId, leagueId);
    }

    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> CreateInvite(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return await gameInviteService.CreateInviteAsync(orgId, leagueId);
    }

    [HttpGet("{inviteId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> GetInvite(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid inviteId)
    {
        return await gameInviteService.GetInviteAsync(orgId, leagueId, inviteId);
    }

    [HttpPost("{inviteId:guid}/players")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> AddPlayers(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromRoute] Guid inviteId,
        [FromBody] AddGameInvitePlayersRequest request)
    {
        return await gameInviteService.AddPlayersAsync(orgId, leagueId, inviteId, request.LeaguePlayerIds);
    }

    [HttpDelete("{inviteId:guid}/players/{leaguePlayerId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> RemovePlayer(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromRoute] Guid inviteId,
        [FromRoute] Guid leaguePlayerId)
    {
        return await gameInviteService.RemoveParticipantAsync(orgId, leagueId, inviteId, leaguePlayerId);
    }

    /// <summary>Leave the invite. Pass <c>removeManagedPlayers=true</c> to also remove players you added.</summary>
    [HttpPost("{inviteId:guid}/leave")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> Leave(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromRoute] Guid inviteId,
        [FromQuery] bool removeManagedPlayers = false)
    {
        return await gameInviteService.LeaveAsync(orgId, leagueId, inviteId, removeManagedPlayers);
    }

    [HttpPost("{inviteId:guid}/cancel")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> Cancel(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid inviteId)
    {
        return await gameInviteService.CancelAsync(orgId, leagueId, inviteId);
    }

    /// <summary>The caller takes control of their own spot from the player who added them.</summary>
    [HttpPost("{inviteId:guid}/take-control")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> TakeControl(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid inviteId)
    {
        return await gameInviteService.TakeControlAsync(orgId, leagueId, inviteId);
    }

    [HttpPost("{inviteId:guid}/rounds/{roundId:guid}/players/{leaguePlayerId:guid}/accept")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> Accept(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromRoute] Guid inviteId,
        [FromRoute] Guid roundId,
        [FromRoute] Guid leaguePlayerId)
    {
        return await gameInviteService.RespondAsync(orgId, leagueId, inviteId, roundId, leaguePlayerId, accept: true);
    }

    [HttpPost("{inviteId:guid}/rounds/{roundId:guid}/players/{leaguePlayerId:guid}/decline")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<GameInviteResponse>> Decline(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromRoute] Guid inviteId,
        [FromRoute] Guid roundId,
        [FromRoute] Guid leaguePlayerId)
    {
        return await gameInviteService.RespondAsync(orgId, leagueId, inviteId, roundId, leaguePlayerId, accept: false);
    }
}
