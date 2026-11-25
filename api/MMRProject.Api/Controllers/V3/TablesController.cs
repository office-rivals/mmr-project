using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

/// <summary>Foosball tables for players: live score, claiming unclaimed matches, linking active matches.</summary>
[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class TablesController(IHardwareAdminService hardwareAdminService, ITableMatchService tableMatchService,
    ITableStatsService tableStatsService)
    : ControllerBase
{
    [HttpGet("tables")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<TableResponse>>> ListTables([FromRoute] Guid orgId)
    {
        return await hardwareAdminService.ListTablesAsync(orgId);
    }

    /// <summary>The table's live state. With <paramref name="since"/> it long-polls, like the scoreboard.</summary>
    /// <param name="since">The <c>version</c> the caller has: the answer is held until it changes, or for
    /// <paramref name="wait"/> seconds (0–60), then it's the current state either way.</param>
    [HttpGet("tables/{tableId:guid}/live")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<LiveTableResponse>> GetLive([FromRoute] Guid orgId, [FromRoute] Guid tableId,
        [FromQuery] long? since, [FromQuery] int wait = 25)
    {
        var live = await tableMatchService.GetLiveTableAsync(orgId, tableId);
        if (since != live.Version)
        {
            return live;
        }

        await tableMatchService.WaitForChangeAsync(tableId, live.Version, TimeSpan.FromSeconds(Math.Clamp(wait, 0, 60)),
            HttpContext.RequestAborted);
        return await tableMatchService.GetLiveTableAsync(orgId, tableId);
    }

    /// <summary>The phone's "New game", as the scoreboard's: save finishes the game (claimable), else it's thrown away.</summary>
    [HttpPost("tables/{tableId:guid}/new-game")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<LiveTableResponse>> NewGame([FromRoute] Guid orgId, [FromRoute] Guid tableId,
        [FromBody] TableNewGameRequest request)
    {
        return await tableMatchService.StartNewGameAsync(orgId, tableId, request.Save, request.ExpectedVersion);
    }

    /// <summary>Every table's headline stats, the combined busy hours and "all tables busy" (METRICS §8.4).</summary>
    /// <param name="tz">IANA time zone for days, hours and office hours (the viewer's); default UTC.</param>
    [HttpGet("tables/stats")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<TablesStatsOverviewResponse>> GetTablesStats([FromRoute] Guid orgId,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, [FromQuery] string? tz)
    {
        return await tableStatsService.GetOverviewAsync(orgId, from, to, tz);
    }

    /// <summary>One table's stats over [from, to) (default: the last 30 days).</summary>
    /// <param name="tz">IANA time zone for days, hours and office hours (the viewer's); default UTC.</param>
    [HttpGet("tables/{tableId:guid}/stats")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<TableStatsResponse>> GetTableStats([FromRoute] Guid orgId, [FromRoute] Guid tableId,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, [FromQuery] string? tz)
    {
        return await tableStatsService.GetTableStatsAsync(orgId, tableId, from, to, tz);
    }

    /// <summary>Finished, unsubmitted, unlinked table matches that can still be claimed.</summary>
    [HttpGet("table-matches")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<TableMatchResponse>>> ListClaimable([FromRoute] Guid orgId,
        [FromQuery] Guid? tableId)
    {
        return await tableMatchService.GetClaimableMatchesAsync(orgId, tableId);
    }

    [HttpPost("leagues/{leagueId:guid}/table-matches/{tableMatchId:guid}/claim")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<MatchResponse>> Claim([FromRoute] Guid orgId, [FromRoute] Guid leagueId,
        [FromRoute] Guid tableMatchId, [FromBody] ClaimTableMatchRequest request)
    {
        return await tableMatchService.ClaimMatchAsync(orgId, leagueId, tableMatchId, request);
    }

    [HttpPost("leagues/{leagueId:guid}/active-matches/{activeMatchId:guid}/link-table")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<LiveTableResponse>> LinkTable([FromRoute] Guid orgId, [FromRoute] Guid leagueId,
        [FromRoute] Guid activeMatchId, [FromBody] LinkTableRequest request)
    {
        return await tableMatchService.LinkActiveMatchAsync(orgId, leagueId, activeMatchId, request);
    }

    /// <summary>The goals of a match played on a table, to fix their scorers. 404 when it wasn't.</summary>
    [HttpGet("leagues/{leagueId:guid}/matches/{matchId:guid}/goals")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<MatchGoalsResponse>> GetMatchGoals([FromRoute] Guid orgId, [FromRoute] Guid leagueId,
        [FromRoute] Guid matchId)
    {
        return await tableMatchService.GetGoalsAsync(orgId, new TableMatchRef(leagueId, matchId, null));
    }

    [HttpPut("leagues/{leagueId:guid}/matches/{matchId:guid}/goals/{goalId:guid}/scorer")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<MatchGoalResponse>> SetMatchGoalScorer([FromRoute] Guid orgId,
        [FromRoute] Guid leagueId, [FromRoute] Guid matchId, [FromRoute] Guid goalId,
        [FromBody] SetGoalScorerRequest request)
    {
        return await tableMatchService.SetGoalScorerAsync(orgId, new TableMatchRef(leagueId, matchId, null), goalId,
            request.LeaguePlayerId);
    }

    /// <summary>As above, for a table match that isn't submitted yet.</summary>
    [HttpGet("table-matches/{tableMatchId:guid}/goals")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<MatchGoalsResponse>> GetTableMatchGoals([FromRoute] Guid orgId,
        [FromRoute] Guid tableMatchId)
    {
        return await tableMatchService.GetGoalsAsync(orgId, new TableMatchRef(null, null, tableMatchId));
    }

    [HttpPut("table-matches/{tableMatchId:guid}/goals/{goalId:guid}/scorer")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<MatchGoalResponse>> SetTableMatchGoalScorer([FromRoute] Guid orgId,
        [FromRoute] Guid tableMatchId, [FromRoute] Guid goalId, [FromBody] SetGoalScorerRequest request)
    {
        return await tableMatchService.SetGoalScorerAsync(orgId, new TableMatchRef(null, null, tableMatchId), goalId,
            request.LeaguePlayerId);
    }
}
