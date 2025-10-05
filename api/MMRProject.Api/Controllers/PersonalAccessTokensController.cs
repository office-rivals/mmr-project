using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/tokens")]
public class PersonalAccessTokensController(
    IPersonalAccessTokenService tokenService,
    IUserService userService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<CreatePersonalAccessTokenResponse>> CreateToken(
        [FromBody, Required] CreatePersonalAccessTokenRequest request)
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized("No authenticated user found");
        }

        var (token, plainTextToken) = await tokenService.GenerateTokenForPlayerAsync(
            currentUser.Id,
            request.Name,
            request.ExpiresAt);

        return new CreatePersonalAccessTokenResponse(
            token.Id,
            token.Name,
            plainTextToken,
            token.ExpiresAt,
            token.CreatedAt);
    }

    [HttpGet]
    public async Task<ActionResult<List<PersonalAccessTokenResponse>>> ListTokens()
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized("No authenticated user found");
        }

        var tokens = await tokenService.ListTokensForPlayerAsync(currentUser.Id);

        return tokens.Select(t => new PersonalAccessTokenResponse(
            t.Id,
            t.Name,
            t.LastUsedAt,
            t.ExpiresAt,
            t.CreatedAt)).ToList();
    }

    [HttpDelete("{tokenId:long}")]
    public async Task<IActionResult> RevokeToken(long tokenId)
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();
        if (currentUser == null)
        {
            return Unauthorized("No authenticated user found");
        }

        try
        {
            await tokenService.RevokeTokenAsync(tokenId, currentUser.Id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ex.Message);
        }
    }
}
