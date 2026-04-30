using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MMRProject.Api.Controllers;

[ApiController]
[AllowAnonymous]
public class DeprecatedApiController : ControllerBase
{
    [HttpGet("api/v1/{**path}")]
    [HttpPost("api/v1/{**path}")]
    [HttpPut("api/v1/{**path}")]
    [HttpDelete("api/v1/{**path}")]
    [HttpPatch("api/v1/{**path}")]
    [HttpGet("api/v2/{**path}")]
    [HttpPost("api/v2/{**path}")]
    [HttpPut("api/v2/{**path}")]
    [HttpDelete("api/v2/{**path}")]
    [HttpPatch("api/v2/{**path}")]
    public IActionResult Gone()
    {
        return StatusCode(410, new { message = "This API version has been removed. Please use the v3 API." });
    }
}
