using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Extensions;
using MMRProject.Api.MMRCalculationApi;
using MMRProject.Api.MMRCalculationApi.Models;


namespace MMRProject.Api.Services.V3;

public interface IV3MatchesService
{
    Task<MatchResponse> SubmitMatchAsync(Guid orgId, Guid leagueId, SubmitMatchRequest request,
        MatchSource source = MatchSource.Manual);
    Task<List<MatchResponse>> GetMatchesAsync(Guid orgId, Guid leagueId, Guid? seasonId, Guid? leaguePlayerId = null, int limit = 50, int offset = 0);
    Task<MatchResponse> GetMatchAsync(Guid orgId, Guid leagueId, Guid matchId);
    Task<MatchResponse> UpdateMatchAsync(Guid orgId, Guid leagueId, Guid matchId, SubmitMatchRequest request);
    Task DeleteMatchAsync(Guid orgId, Guid leagueId, Guid matchId);
    Task<RecalculateMatchesResponse> RecalculateCurrentSeasonAsync(Guid orgId, Guid leagueId, Guid? fromMatchId);
}

public class V3MatchesService(
    ApiDbContext dbContext,
    IMMRCalculationApiClient mmrCalculationApiClient,
    IOrganizationService organizationService,
    IV3SeasonService seasonService,
    ILogger<V3MatchesService> logger) : IV3MatchesService
{
    private const long DefaultMmr = 1500;
    private const decimal DefaultMu = 25.0m;
    private const decimal DefaultSigma = 8.333m;

    public async Task<MatchResponse> SubmitMatchAsync(Guid orgId, Guid leagueId, SubmitMatchRequest request,
        MatchSource source = MatchSource.Manual)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        var currentSeason = await seasonService.GetCurrentSeasonAsync(orgId, leagueId)
            ?? throw new InvalidArgumentException("No active season found for this league");

        var membershipId = await organizationService.GetCurrentMembershipIdAsync(orgId);

        var resolvedTeams = await ResolveAndValidateTeamsAsync(orgId, leagueId, request);
        var leaguePlayers = resolvedTeams.SelectMany(t => t)
            .GroupBy(lp => lp.Id)
            .Select(g => g.First())
            .ToList();

        var now = DateTimeOffset.UtcNow;
        var match = new V3Match
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            SeasonId = currentSeason.Id,
            Source = source,
            CreatedByMembershipId = membershipId,
            PlayedAt = now,
            RecordedAt = now,
        };

        foreach (var team in BuildMatchTeams(orgId, leagueId, request, resolvedTeams))
        {
            match.Teams.Add(team);
        }

        dbContext.Set<V3Match>().Add(match);
        await dbContext.SaveChangesAsync();

        await CalculateAndApplyMmr(orgId, match, leaguePlayers);
        await transaction.CommitAsync();

        return await LoadAndMapMatch(orgId, leagueId, match.Id);
    }

    private async Task<List<List<LeaguePlayer>>> ResolveAndValidateTeamsAsync(
        Guid orgId, Guid leagueId, SubmitMatchRequest request)
    {
        if (request.Teams.Count != 2)
            throw new InvalidArgumentException("A match must have exactly two teams");

        var leagueTeamSize = await dbContext.Leagues
            .Where(l => l.Id == leagueId && l.OrganizationId == orgId)
            .Select(l => (int?)l.TeamSize)
            .FirstOrDefaultAsync()
            ?? throw new NotFoundException($"League with ID '{leagueId}' not found");

        // Shape checks first so a malformed payload short-circuits before any
        // per-player resolution (which can each hit the DB).
        foreach (var team in request.Teams)
        {
            if (team.Players.Count != leagueTeamSize)
                throw new InvalidArgumentException(
                    $"Each team must have exactly {leagueTeamSize} players for this league");
        }

        var resolvedTeams = new List<List<LeaguePlayer>>();
        foreach (var team in request.Teams)
        {
            var resolvedPlayers = new List<LeaguePlayer>();
            foreach (var player in team.Players)
            {
                resolvedPlayers.Add(await ResolveLeaguePlayerAsync(orgId, leagueId, player));
            }

            resolvedTeams.Add(resolvedPlayers);
        }

        var allPlayerIds = resolvedTeams.SelectMany(t => t).Select(lp => lp.Id).ToList();
        if (new HashSet<Guid>(allPlayerIds).Count != allPlayerIds.Count)
            throw new InvalidArgumentException("Players must be unique across all teams");

        return resolvedTeams;
    }

    private static IEnumerable<MatchTeam> BuildMatchTeams(
        Guid orgId,
        Guid leagueId,
        SubmitMatchRequest request,
        List<List<LeaguePlayer>> resolvedTeams,
        Guid? matchId = null)
    {
        var maxScore = request.Teams.Max(t => t.Score);
        var winnerCount = request.Teams.Count(t => t.Score == maxScore);

        for (var teamIndex = 0; teamIndex < request.Teams.Count; teamIndex++)
        {
            var teamRequest = request.Teams[teamIndex];
            var resolvedPlayers = resolvedTeams[teamIndex];

            var matchTeam = new MatchTeam
            {
                OrganizationId = orgId,
                LeagueId = leagueId,
                Index = teamIndex,
                Score = teamRequest.Score,
                IsWinner = winnerCount == 1 && teamRequest.Score == maxScore,
            };
            if (matchId.HasValue) matchTeam.MatchId = matchId.Value;

            for (var playerIndex = 0; playerIndex < resolvedPlayers.Count; playerIndex++)
            {
                matchTeam.Players.Add(new MatchTeamPlayer
                {
                    OrganizationId = orgId,
                    LeagueId = leagueId,
                    LeaguePlayerId = resolvedPlayers[playerIndex].Id,
                    Index = playerIndex,
                });
            }

            yield return matchTeam;
        }
    }

    private async Task<LeaguePlayer> ResolveLeaguePlayerAsync(
        Guid orgId,
        Guid leagueId,
        SubmitMatchPlayerRequest playerRequest)
    {
        var populatedReferenceCount =
            (playerRequest.LeaguePlayerId.HasValue ? 1 : 0)
            + (playerRequest.OrganizationMembershipId.HasValue ? 1 : 0)
            + (playerRequest.NewPlayer is not null ? 1 : 0);

        if (populatedReferenceCount != 1)
        {
            throw new InvalidArgumentException(
                "Each submitted player must specify exactly one of leaguePlayerId, organizationMembershipId, or newPlayer");
        }

        if (playerRequest.LeaguePlayerId.HasValue)
        {
            return await dbContext.LeaguePlayers
                .FirstOrDefaultAsync(lp => lp.Id == playerRequest.LeaguePlayerId.Value
                                           && lp.OrganizationId == orgId
                                           && lp.LeagueId == leagueId)
                ?? throw new InvalidArgumentException("Not all players were found in this league");
        }

        if (playerRequest.OrganizationMembershipId.HasValue)
        {
            var membership = await dbContext.OrganizationMemberships
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.Id == playerRequest.OrganizationMembershipId.Value
                                          && m.OrganizationId == orgId
                                          && m.Status != MembershipStatus.Removed)
                ?? throw new InvalidArgumentException("Organization member was not found");

            return await GetOrCreateLeaguePlayerAsync(orgId, leagueId, membership);
        }

        return await ResolveNewPlayerAsync(orgId, leagueId, playerRequest.NewPlayer!);
    }

    private async Task<LeaguePlayer> ResolveNewPlayerAsync(
        Guid orgId,
        Guid leagueId,
        CreateMatchPlayerRequest newPlayer)
    {
        if (string.IsNullOrWhiteSpace(newPlayer.DisplayName))
        {
            throw new InvalidArgumentException("Display name is required for new players");
        }

        var normalizedEmail = string.IsNullOrWhiteSpace(newPlayer.Email)
            ? null
            : newPlayer.Email.Trim();

        var normalizedUsername = string.IsNullOrWhiteSpace(newPlayer.Username)
            ? null
            : newPlayer.Username.Trim();

        OrganizationMembership? membership = null;

        if (normalizedEmail != null)
        {
            membership = await dbContext.OrganizationMemberships
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.OrganizationId == orgId
                                          && m.Status != MembershipStatus.Removed
                                          && (m.InviteEmail == normalizedEmail
                                              || (m.User != null && m.User.Email == normalizedEmail)));
        }

        if (membership == null)
        {
            User? existingUser = null;
            if (normalizedEmail != null)
            {
                existingUser = await dbContext.V3Users
                    .FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            }

            membership = new OrganizationMembership
            {
                OrganizationId = orgId,
                UserId = existingUser?.Id,
                InviteEmail = existingUser == null ? normalizedEmail : null,
                DisplayName = existingUser?.DisplayName ?? newPlayer.DisplayName.Trim(),
                Username = existingUser?.Username ?? normalizedUsername,
                Role = OrganizationRole.Member,
                Status = existingUser != null
                    ? MembershipStatus.Active
                    : normalizedEmail != null
                        ? MembershipStatus.Invited
                        : MembershipStatus.Active,
                ClaimedAt = existingUser != null ? DateTimeOffset.UtcNow : null,
            };
            dbContext.OrganizationMemberships.Add(membership);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(membership.DisplayName))
            {
                membership.DisplayName = newPlayer.DisplayName.Trim();
            }
            if (string.IsNullOrWhiteSpace(membership.Username) && normalizedUsername != null)
            {
                membership.Username = normalizedUsername;
            }
        }

        return await GetOrCreateLeaguePlayerAsync(orgId, leagueId, membership);
    }

    private async Task<LeaguePlayer> GetOrCreateLeaguePlayerAsync(
        Guid orgId,
        Guid leagueId,
        OrganizationMembership membership)
    {
        var existingPlayer = await dbContext.LeaguePlayers
            .FirstOrDefaultAsync(lp => lp.OrganizationId == orgId
                                       && lp.LeagueId == leagueId
                                       && lp.OrganizationMembershipId == membership.Id);

        if (existingPlayer != null)
        {
            return existingPlayer;
        }

        var leaguePlayer = new LeaguePlayer
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            OrganizationMembershipId = membership.Id,
            Mmr = DefaultMmr,
            Mu = DefaultMu,
            Sigma = DefaultSigma,
        };

        dbContext.LeaguePlayers.Add(leaguePlayer);
        return leaguePlayer;
    }

    public async Task<List<MatchResponse>> GetMatchesAsync(Guid orgId, Guid leagueId, Guid? seasonId, Guid? leaguePlayerId = null, int limit = 50, int offset = 0)
    {
        var query = dbContext.Set<V3Match>()
            .AsNoTracking()
            .Include(m => m.Teams)
                .ThenInclude(t => t.Players)
                    .ThenInclude(p => p.LeaguePlayer)
                        .ThenInclude(lp => lp.OrganizationMembership)
                            .ThenInclude(om => om.User)
            .Where(m => m.OrganizationId == orgId && m.LeagueId == leagueId);

        if (seasonId.HasValue)
            query = query.Where(m => m.SeasonId == seasonId.Value);

        if (leaguePlayerId.HasValue)
            query = query.Where(m => m.Teams.Any(t => t.Players.Any(p => p.LeaguePlayerId == leaguePlayerId.Value)));

        var matches = await query
            .OrderByDescending(m => m.PlayedAt)
            .ThenByDescending(m => m.RecordedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        var matchIds = matches.Select(m => m.Id).ToList();
        var ratingHistories = await dbContext.Set<RatingHistory>()
            .Where(rh => matchIds.Contains(rh.MatchId))
            .ToListAsync();

        var ratingHistoryByMatch = ratingHistories
            .GroupBy(rh => rh.MatchId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(rh => rh.LeaguePlayerId));

        return matches.Select(m => MapToResponse(m, ratingHistoryByMatch.GetValueOrDefault(m.Id))).ToList();
    }

    public async Task<MatchResponse> GetMatchAsync(Guid orgId, Guid leagueId, Guid matchId)
    {
        return await LoadAndMapMatch(orgId, leagueId, matchId);
    }

    public async Task<MatchResponse> UpdateMatchAsync(Guid orgId, Guid leagueId, Guid matchId, SubmitMatchRequest request)
    {
        // No-tracking validation pass — we re-fetch as tracked once child rows are gone.
        var match = await dbContext.Set<V3Match>()
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId && m.LeagueId == leagueId && m.Id == matchId)
            ?? throw new NotFoundException("Match not found");

        var currentSeason = await seasonService.GetCurrentSeasonAsync(orgId, leagueId)
            ?? throw new InvalidArgumentException("No active season found for this league");

        if (match.SeasonId != currentSeason.Id)
            throw new InvalidArgumentException("Only matches in the current season can be edited");

        var resolvedTeams = await ResolveAndValidateTeamsAsync(orgId, leagueId, request);

        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        // Raw delete the old child rows so EF's change tracker doesn't fight when
        // we add the rebuilt teams. Rating history for this match is intentionally
        // left untouched — the caller invokes recalc afterwards.
        var teamIds = await dbContext.Set<MatchTeam>()
            .Where(t => t.MatchId == matchId)
            .Select(t => t.Id)
            .ToListAsync();

        await dbContext.Set<MatchTeamPlayer>()
            .Where(p => teamIds.Contains(p.MatchTeamId))
            .ExecuteDeleteAsync();
        await dbContext.Set<MatchTeam>()
            .Where(t => t.MatchId == matchId)
            .ExecuteDeleteAsync();

        var trackedMatch = await dbContext.Set<V3Match>()
            .FirstOrDefaultAsync(m => m.Id == matchId)
            ?? throw new NotFoundException("Match disappeared during update");

        foreach (var team in BuildMatchTeams(orgId, leagueId, request, resolvedTeams, trackedMatch.Id))
        {
            dbContext.Set<MatchTeam>().Add(team);
        }

        trackedMatch.RecordedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        return await LoadAndMapMatch(orgId, leagueId, trackedMatch.Id);
    }

    public async Task DeleteMatchAsync(Guid orgId, Guid leagueId, Guid matchId)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        var match = await dbContext.Set<V3Match>()
            .Include(m => m.Teams)
                .ThenInclude(t => t.Players)
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId && m.LeagueId == leagueId && m.Id == matchId);

        if (match == null)
            throw new NotFoundException("Match not found");

        var currentSeason = await seasonService.GetCurrentSeasonAsync(orgId, leagueId)
            ?? throw new InvalidArgumentException("No active season found for this league");

        if (match.SeasonId != currentSeason.Id)
            throw new InvalidArgumentException("Only matches in the current season can be deleted");

        var latestMatchId = await dbContext.Set<V3Match>()
            .Where(m => m.OrganizationId == orgId && m.LeagueId == leagueId)
            .OrderByDescending(m => m.PlayedAt)
            .ThenByDescending(m => m.RecordedAt)
            .ThenByDescending(m => m.CreatedAt)
            .Select(m => m.Id)
            .FirstOrDefaultAsync();

        // Latest-match shortcut: roll back ratings to the previous snapshot, no
        // recalc needed. For any earlier match we only delete the match rows;
        // the caller must invoke recalc to fix MMR for the affected players.
        if (latestMatchId == match.Id)
        {
            await RestoreLatestMatchPlayerRatings(match);
        }

        var ratingHistories = await dbContext.RatingHistories
            .Where(rh => rh.MatchId == matchId)
            .ToListAsync();
        dbContext.RatingHistories.RemoveRange(ratingHistories);

        foreach (var team in match.Teams)
        {
            dbContext.Set<MatchTeamPlayer>().RemoveRange(team.Players);
        }
        dbContext.Set<MatchTeam>().RemoveRange(match.Teams);
        dbContext.Set<V3Match>().Remove(match);
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task<RecalculateMatchesResponse> RecalculateCurrentSeasonAsync(
        Guid orgId, Guid leagueId, Guid? fromMatchId)
    {
        var currentSeason = await seasonService.GetCurrentSeasonAsync(orgId, leagueId)
            ?? throw new InvalidArgumentException("No active season found for this league");

        // Determine the chronological lower bound. If a fromMatchId is given,
        // verify it belongs to this league + current season and use its
        // (PlayedAt, RecordedAt, CreatedAt) tuple; otherwise replay the entire
        // season.
        DateTimeOffset? boundPlayedAt = null;
        DateTimeOffset? boundRecordedAt = null;
        DateTimeOffset? boundCreatedAt = null;

        if (fromMatchId.HasValue)
        {
            var fromMatch = await dbContext.Set<V3Match>()
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.OrganizationId == orgId
                                          && m.LeagueId == leagueId
                                          && m.Id == fromMatchId.Value)
                ?? throw new InvalidArgumentException("Starting match not found in this league");

            if (fromMatch.SeasonId != currentSeason.Id)
                throw new InvalidArgumentException("Starting match must be in the current season");

            boundPlayedAt = fromMatch.PlayedAt;
            boundRecordedAt = fromMatch.RecordedAt;
            boundCreatedAt = fromMatch.CreatedAt;
        }

        var matchesQuery = dbContext.Set<V3Match>()
            .Where(m => m.OrganizationId == orgId
                        && m.LeagueId == leagueId
                        && m.SeasonId == currentSeason.Id);

        if (boundPlayedAt.HasValue)
        {
            matchesQuery = matchesQuery.Where(m =>
                m.PlayedAt > boundPlayedAt.Value
                || (m.PlayedAt == boundPlayedAt.Value && m.RecordedAt > boundRecordedAt!.Value)
                || (m.PlayedAt == boundPlayedAt.Value
                    && m.RecordedAt == boundRecordedAt!.Value
                    && m.CreatedAt >= boundCreatedAt!.Value));
        }

        var matchesToReplay = await matchesQuery
            .Include(m => m.Teams)
                .ThenInclude(t => t.Players)
            .OrderBy(m => m.PlayedAt)
                .ThenBy(m => m.RecordedAt)
                .ThenBy(m => m.CreatedAt)
            .ToListAsync();

        if (matchesToReplay.Count == 0)
        {
            return new RecalculateMatchesResponse
            {
                MatchCount = 0,
                FromMatchId = fromMatchId,
                StartedAt = DateTimeOffset.UtcNow,
                CompletedAt = DateTimeOffset.UtcNow,
            };
        }

        var startedAt = DateTimeOffset.UtcNow;

        // Clear rating history rows for all matches we are about to replay.
        var matchIds = matchesToReplay.Select(m => m.Id).ToList();
        var historiesToClear = await dbContext.RatingHistories
            .Where(rh => matchIds.Contains(rh.MatchId))
            .ToListAsync();
        dbContext.RatingHistories.RemoveRange(historiesToClear);

        // Reset every player who appears in the affected matches back to the
        // latest rating snapshot from BEFORE the bound; default if none.
        var affectedPlayerIds = matchesToReplay
            .SelectMany(m => m.Teams)
            .SelectMany(t => t.Players)
            .Select(p => p.LeaguePlayerId)
            .Distinct()
            .ToList();

        var leaguePlayers = await dbContext.LeaguePlayers
            .Where(lp => affectedPlayerIds.Contains(lp.Id))
            .ToListAsync();

        if (boundPlayedAt.HasValue)
        {
            // Snapshot per player: most recent RatingHistory whose match ordering tuple
            // is strictly before the bound.
            var previousRatings = await dbContext.RatingHistories
                .Where(rh => affectedPlayerIds.Contains(rh.LeaguePlayerId))
                .Join(
                    dbContext.Set<V3Match>(),
                    rh => rh.MatchId,
                    m => m.Id,
                    (rh, m) => new
                    {
                        rh.LeaguePlayerId,
                        rh.Mmr,
                        rh.Mu,
                        rh.Sigma,
                        m.PlayedAt,
                        m.RecordedAt,
                        m.CreatedAt,
                    })
                .Where(x => x.PlayedAt < boundPlayedAt.Value
                            || (x.PlayedAt == boundPlayedAt.Value && x.RecordedAt < boundRecordedAt!.Value)
                            || (x.PlayedAt == boundPlayedAt.Value
                                && x.RecordedAt == boundRecordedAt!.Value
                                && x.CreatedAt < boundCreatedAt!.Value))
                .GroupBy(x => x.LeaguePlayerId)
                .Select(g => g.OrderByDescending(x => x.PlayedAt)
                              .ThenByDescending(x => x.RecordedAt)
                              .ThenByDescending(x => x.CreatedAt)
                              .First())
                .ToDictionaryAsync(x => x.LeaguePlayerId);

            foreach (var lp in leaguePlayers)
            {
                if (previousRatings.TryGetValue(lp.Id, out var snapshot))
                {
                    lp.Mmr = snapshot.Mmr;
                    lp.Mu = snapshot.Mu;
                    lp.Sigma = snapshot.Sigma;
                }
                else
                {
                    lp.Mmr = DefaultMmr;
                    lp.Mu = DefaultMu;
                    lp.Sigma = DefaultSigma;
                }
            }
        }
        else
        {
            // Whole-season replay — snap every affected player to their most
            // recent prior-season rating snapshot (or defaults if none). The
            // calculator decides what to do with previous-season inputs; this
            // service only carries them forward.
            var preSeasonRatings = await dbContext.RatingHistories
                .Where(rh => affectedPlayerIds.Contains(rh.LeaguePlayerId))
                .Join(
                    dbContext.Set<V3Match>(),
                    rh => rh.MatchId,
                    m => m.Id,
                    (rh, m) => new
                    {
                        rh.LeaguePlayerId,
                        rh.Mmr,
                        rh.Mu,
                        rh.Sigma,
                        m.SeasonId,
                        m.PlayedAt,
                        m.RecordedAt,
                        m.CreatedAt,
                    })
                .Where(x => x.SeasonId != currentSeason.Id)
                .GroupBy(x => x.LeaguePlayerId)
                .Select(g => g.OrderByDescending(x => x.PlayedAt)
                              .ThenByDescending(x => x.RecordedAt)
                              .ThenByDescending(x => x.CreatedAt)
                              .First())
                .ToDictionaryAsync(x => x.LeaguePlayerId);

            foreach (var lp in leaguePlayers)
            {
                if (preSeasonRatings.TryGetValue(lp.Id, out var snapshot))
                {
                    lp.Mmr = snapshot.Mmr;
                    lp.Mu = snapshot.Mu;
                    lp.Sigma = snapshot.Sigma;
                }
                else
                {
                    lp.Mmr = DefaultMmr;
                    lp.Mu = DefaultMu;
                    lp.Sigma = DefaultSigma;
                }
            }
        }

        await dbContext.SaveChangesAsync();

        // Drives the IsPreviousSeasonRating flag on each replayed match: a
        // player not in this set when their match runs is treated as making
        // their first appearance of the season.
        var playersWithCurrentSeasonHistory = await LoadPlayersWithSeasonHistoryAsync(
            currentSeason.Id, affectedPlayerIds);

        // Replay in batches of 200 (matches v1 chunking) for fewer round trips
        // to the MMR calculation API.
        var leaguePlayerLookup = leaguePlayers.ToDictionary(lp => lp.Id);
        const int batchSize = 200;
        for (var i = 0; i < matchesToReplay.Count; i += batchSize)
        {
            var batch = matchesToReplay.GetRange(i, Math.Min(batchSize, matchesToReplay.Count - i));
            await CalculateAndApplyMmrBatch(orgId, batch, leaguePlayerLookup, playersWithCurrentSeasonHistory);
        }

        return new RecalculateMatchesResponse
        {
            MatchCount = matchesToReplay.Count,
            FromMatchId = fromMatchId,
            StartedAt = startedAt,
            CompletedAt = DateTimeOffset.UtcNow,
        };
    }

    private async Task CalculateAndApplyMmrBatch(
        Guid orgId,
        List<V3Match> matches,
        Dictionary<Guid, LeaguePlayer> leaguePlayerLookup,
        HashSet<Guid> playersWithCurrentSeasonHistory)
    {
        // Each match must be evaluated against the *previous* match's updated
        // ratings. The MMR API's batch endpoint preserves that carry-forward
        // semantic via its internal player map keyed on player.Id, so we send
        // the entire chunk as a single request to cut HTTP round-trips.
        // The MMR API is keyed on long IDs, so we assign a stable long per
        // LeaguePlayer for the duration of the batch — the API then ignores
        // mu/sigma/IsPreviousSeasonRating on subsequent appearances and uses
        // the carried-forward state instead.
        var guidToId = new Dictionary<Guid, long>();
        var idToGuid = new Dictionary<long, Guid>();
        long nextId = 1;

        // playersWithCurrentSeasonHistory captures the state at batch start; it
        // only gets mutated when we apply responses below. To set
        // IsPreviousSeasonRating correctly per-match while building requests up
        // front, virtually track in-batch first appearances here.
        var seenInBatch = new HashSet<Guid>(playersWithCurrentSeasonHistory);

        var batchItems = new List<(V3Match Match, MMRCalculationRequest Request)>(matches.Count);

        foreach (var match in matches)
        {
            var teams = match.Teams.OrderBy(t => t.Index).ToList();
            if (teams.Count != 2)
            {
                logger.LogWarning("Match {MatchId} has {TeamCount} teams, skipping during recalc", match.Id, teams.Count);
                continue;
            }

            foreach (var team in teams)
            {
                foreach (var player in team.Players.OrderBy(p => p.Index))
                {
                    if (guidToId.ContainsKey(player.LeaguePlayerId)) continue;
                    guidToId[player.LeaguePlayerId] = nextId;
                    idToGuid[nextId] = player.LeaguePlayerId;
                    nextId++;
                }
            }

            batchItems.Add((match, new MMRCalculationRequest
            {
                Team1 = BuildTeam(teams[0], guidToId, leaguePlayerLookup, seenInBatch),
                Team2 = BuildTeam(teams[1], guidToId, leaguePlayerLookup, seenInBatch),
            }));

            foreach (var team in teams)
            {
                foreach (var player in team.Players)
                {
                    seenInBatch.Add(player.LeaguePlayerId);
                }
            }
        }

        if (batchItems.Count == 0)
        {
            return;
        }

        var requests = batchItems.Select(b => b.Request).ToList();
        var responses = await mmrCalculationApiClient.CalculateMMRBatchAsync(requests);
        if (responses.Count != batchItems.Count)
        {
            logger.LogError(
                "MMR batch returned {ResponseCount} responses for {RequestCount} requests; aborting recalc",
                responses.Count, batchItems.Count);
            // Subsequent batches in the recalc loop reuse leaguePlayerLookup and
            // playersWithCurrentSeasonHistory; if we skip applying this batch
            // silently the next batch starts from stale state and the recalc
            // ends up half-applied. Throwing aborts the whole operation before
            // any SaveChangesAsync runs.
            throw new InvalidOperationException(
                $"MMR batch returned {responses.Count} responses for {batchItems.Count} requests");
        }

        for (var i = 0; i < responses.Count; i++)
        {
            var match = batchItems[i].Match;
            var response = responses[i];

            foreach (var result in response.Team1.Players.Concat(response.Team2.Players))
            {
                var leaguePlayerId = idToGuid[result.Id];
                var lp = leaguePlayerLookup[leaguePlayerId];
                var isFirstMatchOfSeason = !playersWithCurrentSeasonHistory.Contains(leaguePlayerId);
                var delta = isFirstMatchOfSeason ? 0 : result.MMR - lp.Mmr;

                dbContext.Set<RatingHistory>().Add(new RatingHistory
                {
                    OrganizationId = orgId,
                    LeaguePlayerId = leaguePlayerId,
                    MatchId = match.Id,
                    Mmr = result.MMR,
                    Mu = result.Mu,
                    Sigma = result.Sigma,
                    Delta = delta,
                });

                lp.Mmr = result.MMR;
                lp.Mu = result.Mu;
                lp.Sigma = result.Sigma;

                playersWithCurrentSeasonHistory.Add(leaguePlayerId);
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static MMRCalculationTeam BuildTeam(
        MatchTeam team,
        Dictionary<Guid, long> guidToIndex,
        Dictionary<Guid, LeaguePlayer> leaguePlayerLookup,
        HashSet<Guid> playersWithCurrentSeasonHistory)
    {
        return new MMRCalculationTeam
        {
            Score = team.Score,
            Players = team.Players.OrderBy(p => p.Index).Select(p =>
            {
                var lp = leaguePlayerLookup[p.LeaguePlayerId];
                return new MMRCalculationPlayerRating
                {
                    Id = guidToIndex[p.LeaguePlayerId],
                    Mu = lp.Mu,
                    Sigma = lp.Sigma,
                    IsPreviousSeasonRating = !playersWithCurrentSeasonHistory.Contains(p.LeaguePlayerId),
                };
            }).ToList(),
        };
    }

    private async Task<HashSet<Guid>> LoadPlayersWithSeasonHistoryAsync(
        Guid seasonId,
        IReadOnlyCollection<Guid> playerIds)
    {
        if (playerIds.Count == 0) return [];

        var seasonedIds = await dbContext.RatingHistories
            .Where(rh => playerIds.Contains(rh.LeaguePlayerId))
            .Join(
                dbContext.Set<V3Match>(),
                rh => rh.MatchId,
                m => m.Id,
                (rh, m) => new { rh.LeaguePlayerId, m.SeasonId })
            .Where(x => x.SeasonId == seasonId)
            .Select(x => x.LeaguePlayerId)
            .Distinct()
            .ToListAsync();

        return [.. seasonedIds];
    }

    private async Task<MatchResponse> LoadAndMapMatch(Guid orgId, Guid leagueId, Guid matchId)
    {
        var match = await dbContext.Set<V3Match>()
            .Include(m => m.Teams)
                .ThenInclude(t => t.Players)
                    .ThenInclude(p => p.LeaguePlayer)
                        .ThenInclude(lp => lp.OrganizationMembership)
                            .ThenInclude(om => om.User)
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId && m.LeagueId == leagueId && m.Id == matchId);

        if (match == null)
            throw new NotFoundException("Match not found");

        var ratingHistories = await dbContext.Set<RatingHistory>()
            .Where(rh => rh.MatchId == matchId)
            .ToDictionaryAsync(rh => rh.LeaguePlayerId);

        return MapToResponse(match, ratingHistories);
    }

    private async Task CalculateAndApplyMmr(Guid orgId, V3Match match, List<LeaguePlayer> leaguePlayers)
    {
        var teams = match.Teams.OrderBy(t => t.Index).ToList();
        if (teams.Count != 2)
        {
            logger.LogWarning("Match {MatchId} has {TeamCount} teams, skipping MMR calculation (requires exactly 2)", match.Id, teams.Count);
            return;
        }

        var leaguePlayerLookup = leaguePlayers.ToDictionary(lp => lp.Id);
        var playerIds = leaguePlayers.Select(lp => lp.Id).ToList();
        var playersWithCurrentSeasonHistory = await LoadPlayersWithSeasonHistoryAsync(
            match.SeasonId, playerIds);

        var guidToIndex = new Dictionary<Guid, long>();
        var indexToGuid = new Dictionary<long, Guid>();
        long index = 1;
        foreach (var team in teams)
        {
            foreach (var player in team.Players.OrderBy(p => p.Index))
            {
                guidToIndex[player.LeaguePlayerId] = index;
                indexToGuid[index] = player.LeaguePlayerId;
                index++;
            }
        }

        var mmrRequest = new MMRCalculationRequest
        {
            Team1 = BuildTeam(teams[0], guidToIndex, leaguePlayerLookup, playersWithCurrentSeasonHistory),
            Team2 = BuildTeam(teams[1], guidToIndex, leaguePlayerLookup, playersWithCurrentSeasonHistory),
        };

        MMRCalculationResponse mmrResponse;
        try
        {
            mmrResponse = await mmrCalculationApiClient.CalculateMMRAsync(mmrRequest);
        }
        catch (Exception e)
        {
            logger.LogCritical(e, "Failed to calculate MMR for match {MatchId}", match.Id);
            throw;
        }

        var playerResults = mmrResponse.Team1.Players
            .Concat(mmrResponse.Team2.Players)
            .ToDictionary(r => indexToGuid[r.Id]);

        foreach (var (leaguePlayerId, result) in playerResults)
        {
            var leaguePlayer = leaguePlayerLookup[leaguePlayerId];
            var isFirstMatchOfSeason = !playersWithCurrentSeasonHistory.Contains(leaguePlayerId);
            var delta = isFirstMatchOfSeason ? 0 : result.MMR - leaguePlayer.Mmr;

            var ratingHistory = new RatingHistory
            {
                OrganizationId = orgId,
                LeaguePlayerId = leaguePlayerId,
                MatchId = match.Id,
                Mmr = result.MMR,
                Mu = result.Mu,
                Sigma = result.Sigma,
                Delta = delta,
            };
            dbContext.Set<RatingHistory>().Add(ratingHistory);

            leaguePlayer.Mmr = result.MMR;
            leaguePlayer.Mu = result.Mu;
            leaguePlayer.Sigma = result.Sigma;
        }

        await dbContext.SaveChangesAsync();
    }

    private async Task RestoreLatestMatchPlayerRatings(V3Match match)
    {
        var impactedPlayerIds = match.Teams
            .SelectMany(t => t.Players)
            .Select(p => p.LeaguePlayerId)
            .Distinct()
            .ToList();

        var leaguePlayers = await dbContext.LeaguePlayers
            .Where(lp => impactedPlayerIds.Contains(lp.Id))
            .ToDictionaryAsync(lp => lp.Id);

        var previousRatings = await dbContext.RatingHistories
            .Where(rh => impactedPlayerIds.Contains(rh.LeaguePlayerId) && rh.MatchId != match.Id)
            .Join(
                dbContext.Set<V3Match>(),
                rh => rh.MatchId,
                m => m.Id,
                (rh, m) => new
                {
                    rh.LeaguePlayerId,
                    rh.Mmr,
                    rh.Mu,
                    rh.Sigma,
                    m.PlayedAt,
                    m.RecordedAt,
                    m.CreatedAt,
                })
            .Where(x => x.PlayedAt < match.PlayedAt
                        || (x.PlayedAt == match.PlayedAt && x.RecordedAt < match.RecordedAt)
                        || (x.PlayedAt == match.PlayedAt && x.RecordedAt == match.RecordedAt
                            && x.CreatedAt < match.CreatedAt))
            .GroupBy(x => x.LeaguePlayerId)
            .Select(g => g
                .OrderByDescending(x => x.PlayedAt)
                .ThenByDescending(x => x.RecordedAt)
                .ThenByDescending(x => x.CreatedAt)
                .First())
            .ToDictionaryAsync(x => x.LeaguePlayerId);

        foreach (var playerId in impactedPlayerIds)
        {
            var leaguePlayer = leaguePlayers[playerId];
            if (previousRatings.TryGetValue(playerId, out var previous))
            {
                leaguePlayer.Mmr = previous.Mmr;
                leaguePlayer.Mu = previous.Mu;
                leaguePlayer.Sigma = previous.Sigma;
                continue;
            }

            leaguePlayer.Mmr = DefaultMmr;
            leaguePlayer.Mu = DefaultMu;
            leaguePlayer.Sigma = DefaultSigma;
        }
    }

    private static MatchResponse MapToResponse(V3Match match, Dictionary<Guid, RatingHistory>? ratingHistories)
    {
        return new MatchResponse
        {
            Id = match.Id,
            LeagueId = match.LeagueId,
            SeasonId = match.SeasonId,
            Source = match.Source,
            PlayedAt = match.PlayedAt,
            RecordedAt = match.RecordedAt,
            CreatedAt = match.CreatedAt,
            Teams = match.Teams.OrderBy(t => t.Index).Select(t => new MatchTeamResponse
            {
                Id = t.Id,
                Index = t.Index,
                Score = t.Score,
                IsWinner = t.IsWinner,
                Players = t.Players.OrderBy(p => p.Index).Select(p => new MatchTeamPlayerResponse
                {
                    Id = p.Id,
                    LeaguePlayerId = p.LeaguePlayerId,
                    DisplayName = p.LeaguePlayer?.OrganizationMembership?.GetDisplayName(),
                    Username = p.LeaguePlayer?.OrganizationMembership?.GetUsername(),
                    Index = p.Index,
                    RatingDelta = ratingHistories?.GetValueOrDefault(p.LeaguePlayerId)?.Delta,
                }).ToList(),
            }).ToList(),
        };
    }
}
