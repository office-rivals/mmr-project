using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/chip-registration")]
public class ChipController(IUserService userService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult> Post(ChipRegistrationRequest request)
    {
        await userService.RegisterChipToUser(request.ChipId, request.ColorCode);
        return Ok(
            $"Scan successful. Chip {request.ChipId} registered with UserId {ColorCodeHelper.ConvertBase4ToIntId(request.ColorCode)}."
        );
    }
}
