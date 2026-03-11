using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/me")]
[Authorize]
public class MeController(ISessionService sessionService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<MeResponse>> GetMe()
    {
        return await sessionService.GetMeAsync();
    }
}
