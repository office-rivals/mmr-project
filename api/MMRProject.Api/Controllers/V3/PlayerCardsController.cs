using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

/// <summary>The caller's NFC cards (tapped on a scoreboard to join its roster).</summary>
[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/me/cards")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
[Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
public class PlayerCardsController(ICardService cardService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<PlayerCardResponse>>> ListMine([FromRoute] Guid orgId)
    {
        return await cardService.ListMineAsync(orgId);
    }

    /// <summary>
    /// Link the unknown card behind a scoreboard's <c>/t/{code}</c> link to the caller, or to another active
    /// member (<c>membershipId</c>); its owner joins that table's roster.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<PlayerCardResponse>> Link([FromRoute] Guid orgId, [FromBody] LinkCardRequest request)
    {
        var card = await cardService.LinkAsync(orgId, request.Code, request.MembershipId);
        return Created($"api/v3/organizations/{orgId}/me/cards", card);
    }

    [HttpDelete("{cardId:guid}")]
    public async Task<IActionResult> DeleteMine([FromRoute] Guid orgId, [FromRoute] Guid cardId)
    {
        await cardService.DeleteMineAsync(orgId, cardId);
        return NoContent();
    }
}
