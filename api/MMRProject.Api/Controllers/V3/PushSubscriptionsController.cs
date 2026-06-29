using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/me/push/subscription")]
[Authorize]
public class PushSubscriptionsController(IPushSubscriptionService subscriptionService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PushSubscriptionStatusResponse>> GetStatus()
    {
        var subscribed = await subscriptionService.HasSubscriptionAsync();
        return new PushSubscriptionStatusResponse
        {
            Subscribed = subscribed,
            Permission = null,
        };
    }

    [HttpPost]
    public async Task<ActionResult> Subscribe([FromBody] PushSubscriptionRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Endpoint)
            || string.IsNullOrWhiteSpace(request.Keys.P256DH)
            || string.IsNullOrWhiteSpace(request.Keys.Auth))
        {
            return BadRequest("Endpoint and keys are required");
        }

        await subscriptionService.UpsertAsync(request, cancellationToken);
        return NoContent();
    }

    [HttpDelete]
    public async Task<ActionResult> Unsubscribe([FromQuery] string endpoint, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            return BadRequest("endpoint query parameter is required");
        }

        await subscriptionService.DeleteAsync(endpoint, cancellationToken);
        return NoContent();
    }
}