using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/me/tokens")]
[Authorize]
public class V3PersonalAccessTokensController(IV3PersonalAccessTokenService tokenService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<TokenResponse>>> ListTokens()
    {
        return await tokenService.ListTokensAsync();
    }

    [HttpPost]
    public async Task<ActionResult<CreateTokenResponse>> CreateToken([FromBody] CreateTokenRequest request)
    {
        var result = await tokenService.GenerateTokenAsync(request);
        return Created($"api/v3/me/tokens/{result.TokenDetails.Id}", result);
    }

    [HttpDelete("{tokenId:guid}")]
    public async Task<ActionResult> RevokeToken(Guid tokenId)
    {
        await tokenService.RevokeTokenAsync(tokenId);
        return NoContent();
    }
}
