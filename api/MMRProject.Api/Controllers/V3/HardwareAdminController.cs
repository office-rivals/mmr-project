using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/admin")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
[Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
public class HardwareAdminController(IHardwareAdminService hardwareAdminService, ICardService cardService)
    : ControllerBase
{
    [HttpPost("tables")]
    public async Task<ActionResult<TableResponse>> CreateTable([FromRoute] Guid orgId,
        [FromBody] UpsertTableRequest request)
    {
        var result = await hardwareAdminService.CreateTableAsync(orgId, request);
        return Created($"api/v3/organizations/{orgId}/tables/{result.Id}/live", result);
    }

    [HttpPut("tables/{tableId:guid}")]
    public async Task<ActionResult<TableResponse>> UpdateTable([FromRoute] Guid orgId, [FromRoute] Guid tableId,
        [FromBody] UpsertTableRequest request)
    {
        return await hardwareAdminService.UpdateTableAsync(orgId, tableId, request);
    }

    [HttpDelete("tables/{tableId:guid}")]
    public async Task<IActionResult> DeleteTable([FromRoute] Guid orgId, [FromRoute] Guid tableId)
    {
        await hardwareAdminService.DeleteTableAsync(orgId, tableId);
        return NoContent();
    }

    /// <summary>
    /// Replace the table's permanent short-link code with a random one, or with <c>code</c> (readable, 3–32 of
    /// [a-z0-9-], case-insensitive; 409 if taken). The old link (NFC sticker) stops working.
    /// </summary>
    [HttpPost("tables/{tableId:guid}/short-code")]
    public async Task<ActionResult<TableResponse>> SetShortCode([FromRoute] Guid orgId, [FromRoute] Guid tableId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] SetTableShortCodeRequest? request)
    {
        return await hardwareAdminService.SetTableShortCodeAsync(orgId, tableId, request?.Code);
    }

    [HttpGet("devices")]
    public async Task<ActionResult<List<DeviceResponse>>> ListDevices([FromRoute] Guid orgId)
    {
        return await hardwareAdminService.ListDevicesAsync(orgId);
    }

    /// <summary>Accepted goals that fit no match (newest 200). They are kept, never discarded.</summary>
    [HttpGet("orphan-goals")]
    public async Task<ActionResult<List<OrphanGoalResponse>>> ListOrphanGoals([FromRoute] Guid orgId,
        [FromQuery] Guid? tableId)
    {
        return await hardwareAdminService.ListOrphanGoalsAsync(orgId, tableId);
    }

    /// <summary>Claim a device and set its role, table and end.</summary>
    [HttpPut("devices/{deviceId}")]
    public async Task<ActionResult<DeviceResponse>> AssignDevice([FromRoute] Guid orgId, [FromRoute] string deviceId,
        [FromBody] AssignDeviceRequest request)
    {
        return await hardwareAdminService.AssignDeviceAsync(orgId, deviceId, request);
    }

    /// <summary>Forget the device's secret and assignment; it re-enrols as unclaimed on its next request.</summary>
    [HttpPost("devices/{deviceId}/reset")]
    public async Task<ActionResult<DeviceResponse>> ResetDevice([FromRoute] Guid orgId, [FromRoute] string deviceId)
    {
        return await hardwareAdminService.ResetDeviceAsync(orgId, deviceId);
    }

    /// <summary>Set a goal counter's beam config (applies at its next config pull).</summary>
    [HttpPut("devices/{deviceId}/beam-config")]
    public async Task<ActionResult<DeviceResponse>> SetBeamConfig([FromRoute] Guid orgId, [FromRoute] string deviceId,
        [FromBody] BeamConfig request)
    {
        return await hardwareAdminService.SetBeamConfigAsync(orgId, deviceId, request);
    }

    [HttpGet("device-enrolment-token")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<ActionResult<EnrolmentTokenStatusResponse>> GetEnrolmentToken([FromRoute] Guid orgId)
    {
        return await hardwareAdminService.GetEnrolmentTokenStatusAsync(orgId);
    }

    /// <summary>Create or replace the token devices enrol with. Registered devices keep working.</summary>
    [HttpPost("device-enrolment-token")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<ActionResult<EnrolmentTokenResponse>> RotateEnrolmentToken([FromRoute] Guid orgId)
    {
        return await hardwareAdminService.RotateEnrolmentTokenAsync(orgId);
    }

    [HttpDelete("device-enrolment-token")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<IActionResult> RevokeEnrolmentToken([FromRoute] Guid orgId)
    {
        await hardwareAdminService.RevokeEnrolmentTokenAsync(orgId);
        return NoContent();
    }

    [HttpGet("cards")]
    public async Task<ActionResult<List<AdminPlayerCardResponse>>> ListCards([FromRoute] Guid orgId,
        [FromQuery] Guid? membershipId)
    {
        return await cardService.ListAsync(orgId, membershipId);
    }

    [HttpDelete("cards/{cardId:guid}")]
    public async Task<IActionResult> DeleteCard([FromRoute] Guid orgId, [FromRoute] Guid cardId)
    {
        await cardService.DeleteAsync(orgId, cardId);
        return NoContent();
    }

    /// <summary>Unlink every card in the organization (members re-link with one scan).</summary>
    [HttpDelete("cards")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<ActionResult<DeletedCountResponse>> DeleteAllCards([FromRoute] Guid orgId)
    {
        return new DeletedCountResponse { Deleted = await cardService.DeleteAllAsync(orgId) };
    }
}
