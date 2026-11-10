using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

/// <summary>Resolves the <c>/t/{code}</c> links printed on scoreboards (QR) and table NFC stickers.</summary>
[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/short-links")]
[Authorize]
public class ShortLinksController(ITableMatchService tableMatchService) : ControllerBase
{
    [HttpGet("{code}")]
    public async Task<ActionResult<ShortLinkResponse>> Resolve([FromRoute] string code)
    {
        return await tableMatchService.ResolveShortLinkAsync(code);
    }
}
