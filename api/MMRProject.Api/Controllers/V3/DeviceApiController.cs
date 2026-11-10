using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Auth;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

/// <summary>
/// The table devices' API. Contract: firmware/openapi.yaml in office-rivals/mmr-hardware (snake_case JSON), so it is left
/// out of the generated Swagger document.
/// </summary>
[ApiController]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("api/v3/hardware")]
[Authorize(Policy = V3AuthorizationPolicies.RequireDevice)]
public partial class DeviceApiController(ApiDbContext dbContext, ITableMatchService tableMatchService)
    : ControllerBase
{
    [GeneratedRegex("^fb-[0-9a-f]{12}-[0-9a-f]{8}-[0-9]+$")]
    private static partial Regex EventIdPattern();

    [GeneratedRegex("^([0-9A-Fa-f]{8}|[0-9A-Fa-f]{14}|[0-9A-Fa-f]{20})$")]
    private static partial Regex CardUidPattern();

    [HttpGet("devices/{deviceId}/config")]
    public async Task<IActionResult> GetConfig([FromRoute] string deviceId)
    {
        var device = await CurrentDeviceAsync(deviceId);
        if (device is null) return StatusCode(StatusCodes.Status403Forbidden);

        if (device is not { Claimed: true, Role: { } role, TableId: { } tableId })
        {
            return NotFound();
        }

        var config = JsonSerializer.SerializeToNode(new DeviceConfigResponse
        {
            Role = role == DeviceRole.Goal ? "goal" : "scoreboard",
            TableId = tableId.ToString(),
            Goal = role == DeviceRole.Goal ? device.End?.ToString() : null,
            End = role == DeviceRole.Scoreboard ? device.End?.ToString() : null,
            ConfigVersion = device.ConfigVersion,
            UndoWindowS = role == DeviceRole.Goal ? tableMatchService.UndoWindowSeconds : null,
            SoundVolume = await dbContext.FoosballTables.Where(t => t.Id == tableId).Select(t => t.SoundVolume).FirstOrDefaultAsync(),
        }, DeviceJson.Options)!.AsObject();
        // The beam config as DeviceConfig.beam_* fields; a field left at the firmware default is omitted.
        if (role == DeviceRole.Goal && device.BeamConfig is not null)
        {
            foreach (var (key, value) in JsonNode.Parse(device.BeamConfig)!.AsObject())
            {
                if (value is not null) config["beam_" + key] = value.DeepClone();
            }
        }

        return DeviceJsonResult(config);
    }

    [HttpPost("goal-events")]
    public async Task<IActionResult> PostGoalEvent()
    {
        var request = await ReadBodyAsync<GoalEventRequest>();
        if (request is null || !EventIdPattern().IsMatch(request.EventId) ||
            !request.EventId.StartsWith(request.DeviceId + "-", StringComparison.Ordinal))
        {
            return BadRequest();
        }

        var device = await CurrentDeviceAsync(request.DeviceId);
        if (device is null)
        {
            // Another device's event: permanent rejection, the device drops it.
            return UnprocessableEntity();
        }

        var (recorded, score) = await tableMatchService.RecordGoalAsync(device, request);
        return recorded ? CreatedWithScore(score) : Conflict();
    }

    /// <summary>A goal counter's undo button: undoes its own goal within <c>undo_window_s</c>.</summary>
    [HttpPost("undo-events")]
    public async Task<IActionResult> PostUndoEvent()
    {
        var request = await ReadBodyAsync<UndoEventRequest>();
        if (request is null || !EventIdPattern().IsMatch(request.EventId) ||
            !request.EventId.StartsWith(request.DeviceId + "-", StringComparison.Ordinal) ||
            !EventIdPattern().IsMatch(request.UndoesEventId))
        {
            return BadRequest();
        }

        var device = await CurrentDeviceAsync(request.DeviceId);
        if (device is null)
        {
            return UnprocessableEntity();
        }

        var (duplicate, refusal, score) = await tableMatchService.RecordUndoAsync(device, request);
        if (refusal is { } code)
        {
            return DeviceJsonResult(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Undo refused",
                Extensions = { ["code"] = JsonNamingPolicy.SnakeCaseLower.ConvertName(code.ToString()) },
            }, StatusCodes.Status422UnprocessableEntity);
        }

        return duplicate ? Conflict() : CreatedWithScore(score);
    }

    [HttpPost("devices/{deviceId}/status")]
    public async Task<IActionResult> PostStatus([FromRoute] string deviceId)
    {
        var device = await CurrentDeviceAsync(deviceId);
        if (device is null) return StatusCode(StatusCodes.Status403Forbidden);

        using var body = await JsonDocument.ParseAsync(Request.Body);
        DeviceStatusRequest? request;
        try
        {
            request = body.RootElement.Deserialize<DeviceStatusRequest>(DeviceJson.Options);
        }
        catch (JsonException)
        {
            request = null;
        }

        if (request is null || request.DeviceId != deviceId)
        {
            return BadRequest();
        }

        await tableMatchService.RecordStatusAsync(device, request, body.RootElement.GetRawText());
        return NoContent();
    }

    [HttpGet("devices/{deviceId}/scoreboard")]
    public async Task<IActionResult> GetScoreboard([FromRoute] string deviceId, [FromQuery] long? since,
        [FromQuery] int wait = 25)
    {
        var device = await CurrentDeviceAsync(deviceId);
        if (device is null) return StatusCode(StatusCodes.Status403Forbidden);

        if (device is not { Claimed: true, Role: DeviceRole.Scoreboard, TableId: { } tableId })
        {
            return NotFound();
        }

        if (since is { } version &&
            !await tableMatchService.WaitForChangeAsync(tableId, version,
                TimeSpan.FromSeconds(Math.Clamp(wait, 0, 60)), HttpContext.RequestAborted))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        var state = await tableMatchService.GetScoreboardStateAsync(device);
        return state is null ? NotFound() : DeviceJsonResult(state);
    }

    [HttpPost("devices/{deviceId}/scoreboard/actions")]
    public async Task<IActionResult> PostScoreboardAction([FromRoute] string deviceId)
    {
        var device = await CurrentDeviceAsync(deviceId);
        if (device is null) return StatusCode(StatusCodes.Status403Forbidden);

        var request = await ReadBodyAsync<ScoreboardActionRequest>();
        if (request is null ||
            (request.Type == ScoreboardActionType.NewGame && request.Save is null) ||
            (request.Type == ScoreboardActionType.AssignScorer && request.GoalId is null) ||
            (request.Type == ScoreboardActionType.Scan && (request.Uid is null || !CardUidPattern().IsMatch(request.Uid))) ||
            (request.Type == ScoreboardActionType.RemovePlayer && request.PlayerId is null))
        {
            return BadRequest();
        }

        var (applied, state) = await tableMatchService.ApplyScoreboardActionAsync(device, request);
        return DeviceJsonResult(state, applied ? StatusCodes.Status200OK : StatusCodes.Status409Conflict);
    }

    /// <returns>The authenticated device, or null when it isn't <paramref name="deviceId"/>.</returns>
    private async Task<Device?> CurrentDeviceAsync(string deviceId)
    {
        var pk = Guid.Parse(User.FindFirst(DeviceAuthenticationHandler.DevicePkClaim)!.Value);
        var device = await dbContext.Devices.FindAsync(pk);
        return device?.HardwareId == deviceId ? device : null;
    }

    private async Task<T?> ReadBodyAsync<T>() where T : class
    {
        try
        {
            return await JsonSerializer.DeserializeAsync<T>(Request.Body, DeviceJson.Options);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>201 with the match's score for the counter's screen; empty for an orphan.</summary>
    private IActionResult CreatedWithScore(EventScoreResponse? score) =>
        score is null ? StatusCode(StatusCodes.Status201Created) : DeviceJsonResult(score, StatusCodes.Status201Created);

    private static JsonResult DeviceJsonResult(object value, int statusCode = StatusCodes.Status200OK) =>
        new(value, DeviceJson.Options) { StatusCode = statusCode };
}
