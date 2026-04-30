using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.Mappers;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/seasons")]
[Authorize(Policy = AuthorizationPolicies.RequireModeratorRole)]
public class AdminSeasonsController(ISeasonService seasonService) : ControllerBase
{
    public record CreateSeasonRequest(DateTimeOffset? StartsAt = null);

    [HttpPost]
    public async Task<IActionResult> CreateSeason([FromBody] CreateSeasonRequest? request)
    {
        var season = await seasonService.CreateSeasonAsync(request?.StartsAt);
        return CreatedAtAction(nameof(SeasonsController.GetSeason), "Seasons", new { id = season.Id }, season.ToSeasonDto());
    }
}
