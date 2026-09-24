using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Extensions;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3")]
[Authorize]
public class HardwareController(
    IHardwareService hardwareService,
    IPairingService pairingService) : ControllerBase
{
    [HttpPost("hardware/heartbeat")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireHardwareSecret)]
    public async Task<IActionResult> RecordHeartbeat([FromBody] HardwareHeartbeatRequest request)
    {
        await hardwareService.RecordHeartbeatAsync(User.GetHardwareId()!.Value, request);
        return NoContent();
    }

    [HttpPost("hardware/pairing")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireHardwareSecret)]
    public async Task<ActionResult<PairingSubmitResponse>> SubmitPairing([FromBody] PairingSubmitRequest request)
    {
        return await pairingService.SubmitPairingAsync(request);
    }

    [HttpGet("organizations/{orgId:guid}/leagues/{leagueId:guid}/hardware")]
    [Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<List<HardwareResponse>>> List(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId)
    {
        return await hardwareService.ListAsync(orgId, leagueId);
    }

    [HttpPost("organizations/{orgId:guid}/leagues/{leagueId:guid}/hardware")]
    [Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<RegisterHardwareResponse>> Register(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromBody] RegisterHardwareRequest request)
    {
        return await hardwareService.RegisterAsync(orgId, leagueId, request);
    }

    [HttpPost("organizations/{orgId:guid}/leagues/{leagueId:guid}/hardware/{hardwareId:guid}/rotate")]
    [Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<RotateHardwareSecretResponse>> RotateSecret(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromRoute] Guid hardwareId)
    {
        return await hardwareService.RotateSecretAsync(orgId, leagueId, hardwareId);
    }

    [HttpPost("organizations/{orgId:guid}/leagues/{leagueId:guid}/hardware/{hardwareId:guid}/revoke")]
    [Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<IActionResult> Revoke(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromRoute] Guid hardwareId)
    {
        await hardwareService.RevokeAsync(orgId, leagueId, hardwareId);
        return NoContent();
    }
}
