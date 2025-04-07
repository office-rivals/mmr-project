using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;
using MMRProject.Api.Mappers;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/seasons")]
public class SeasonsController(ISeasonService seasonService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SeasonDto>>> GetSeasons()
    {
        var seasons = await seasonService.GetAllSeasonsAsync();
        return seasons.Select(x => x.ToSeasonDto()).ToList();
    }
}