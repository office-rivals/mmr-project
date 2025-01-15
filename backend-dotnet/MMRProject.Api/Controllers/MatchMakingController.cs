using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/match-making")]
public class MatchMakingController(IMatchMakingService matchMakingService) : ControllerBase
{
    [HttpGet("active-matches")]
    public async Task<ActionResult<IEnumerable<ActiveMatchDto>>> GetActiveMatches()
    {
        var matches = await matchMakingService.ActiveMatchesAsync();
        return Ok(matches);
    }

    [HttpDelete("active-matches/{matchId:long}")]
    public async Task<IActionResult> CancelActiveMatch([FromRoute] long matchId)
    {
        await matchMakingService.CancelActiveMatchAsync(matchId);

        return Ok();
    }

    [HttpPost("active-matches/{matchId:long}/submit")]
    public async Task<IActionResult> SubmitActiveMatchResult([FromRoute] long matchId,
        [FromBody] ActiveMatchSubmitRequest request)
    {
        await matchMakingService.SubmitActiveMatchResultAsync(matchId, request);
        return Ok();
    }

    [HttpGet("pending-matches/{matchId:long}")]
    public async Task<ActionResult<PendingMatchDto>> GetPendingMatch([FromRoute] long matchId)
    {
        var status = await matchMakingService.PendingMatchStatusAsync(matchId);
        return new PendingMatchDto
        {
            Id = matchId,
            Status = status
        };
    }

    [HttpPost("pending-matches/{matchId:long}/accept")]
    public async Task<IActionResult> AcceptMatch([FromRoute] long matchId)
    {
        await matchMakingService.AcceptPendingMatchAsync(matchId);
        return Ok();
    }

    [HttpPost("pending-matches/{matchId:long}/decline")]
    public async Task<IActionResult> DeclineMatch([FromRoute] long matchId)
    {
        await matchMakingService.DeclinePendingMatchAsync(matchId);
        return Ok();
    }

    [HttpPost("queue")]
    public async Task<IActionResult> QueueForMatchMaking([FromBody] QueueForMatchMakingRequest request)
    {
        await matchMakingService.AddPlayerToQueueAsync();
        return Ok();
    }

    [HttpDelete("queue")]
    public async Task<IActionResult> LeaveMatchMakingQueue()
    {
        await matchMakingService.RemovePlayerFromQueueAsync();
        return Ok();
    }

    [HttpGet("queue")]
    public async Task<ActionResult<MatchMakingQueueStatus>> GetMatchMakingQueueStatus()
    {
        return await matchMakingService.MatchMakingQueueStatusAsync();
    }
}