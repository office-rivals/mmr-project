using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations")]
[Authorize]
public class OrganizationsController(IOrganizationService organizationService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<OrganizationResponse>> CreateOrganization(
        [FromBody] CreateOrganizationRequest request)
    {
        var result = await organizationService.CreateOrganizationAsync(request);
        return Created($"api/v3/organizations/{result.Id}", result);
    }

    [HttpGet("{orgId:guid}")]
    public async Task<ActionResult<OrganizationResponse>> GetOrganization([FromRoute] Guid orgId)
    {
        return await organizationService.GetOrganizationAsync(orgId);
    }

    [HttpPatch("{orgId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<ActionResult<OrganizationResponse>> UpdateOrganization(
        [FromRoute] Guid orgId, [FromBody] UpdateOrganizationRequest request)
    {
        return await organizationService.UpdateOrganizationAsync(orgId, request);
    }
}
