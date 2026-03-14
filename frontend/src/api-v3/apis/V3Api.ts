/* tslint:disable */
/* eslint-disable */
import * as runtime from '../runtime';
import type {
  MeResponse,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationResponse,
  OrganizationMemberResponse,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  CreateLeagueRequest,
  UpdateLeagueRequest,
  LeagueResponse,
  LeaguePlayerResponse,
  CreateSeasonRequest,
  SeasonResponse,
  SubmitMatchRequest,
  MatchResponse,
  LeaderboardResponse,
  RatingHistoryResponse,
  QueueStatusResponse,
  PendingMatchResponse,
  ActiveMatchResponse,
  SubmitActiveMatchResultRequest,
  CreateMatchFlagRequest,
  UpdateMatchFlagReasonRequest,
  ResolveMatchFlagRequest,
  MatchFlagResponse,
  CreateTokenRequest,
  TokenResponse,
  CreateTokenResponse,
  MatchFlagStatus,
} from '../models/index';

// Me API
export class MeApi extends runtime.BaseAPI {
  async getMe(): Promise<MeResponse> {
    const response = await this.request({ path: '/api/v3/me', method: 'GET', headers: {} });
    return await response.json();
  }
}

// Organizations API
export class OrganizationsApi extends runtime.BaseAPI {
  async createOrganization(request: CreateOrganizationRequest): Promise<OrganizationResponse> {
    const response = await this.request({ path: '/api/v3/organizations', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async getOrganization(orgId: string): Promise<OrganizationResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}`, method: 'GET', headers: {} });
    return await response.json();
  }

  async updateOrganization(orgId: string, request: UpdateOrganizationRequest): Promise<OrganizationResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}`, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }
}

// Organization Members API
export class OrganizationMembersApi extends runtime.BaseAPI {
  async listMembers(orgId: string): Promise<OrganizationMemberResponse[]> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/members`, method: 'GET', headers: {} });
    return await response.json();
  }

  async inviteMember(orgId: string, request: InviteMemberRequest): Promise<OrganizationMemberResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/members`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async updateMemberRole(orgId: string, membershipId: string, request: UpdateMemberRoleRequest): Promise<OrganizationMemberResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/members/${membershipId}`, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async removeMember(orgId: string, membershipId: string): Promise<void> {
    await this.request({ path: `/api/v3/organizations/${orgId}/members/${membershipId}`, method: 'DELETE', headers: {} });
  }
}

// Leagues API
export class LeaguesApi extends runtime.BaseAPI {
  async createLeague(orgId: string, request: CreateLeagueRequest): Promise<LeagueResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async listLeagues(orgId: string): Promise<LeagueResponse[]> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues`, method: 'GET', headers: {} });
    return await response.json();
  }

  async getLeague(orgId: string, leagueId: string): Promise<LeagueResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}`, method: 'GET', headers: {} });
    return await response.json();
  }

  async updateLeague(orgId: string, leagueId: string, request: UpdateLeagueRequest): Promise<LeagueResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}`, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }
}

// League Players API
export class LeaguePlayersApi extends runtime.BaseAPI {
  async joinLeague(orgId: string, leagueId: string): Promise<LeaguePlayerResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/players`, method: 'POST', headers: {} });
    return await response.json();
  }

  async listPlayers(orgId: string, leagueId: string): Promise<LeaguePlayerResponse[]> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/players`, method: 'GET', headers: {} });
    return await response.json();
  }

  async getMe(orgId: string, leagueId: string): Promise<LeaguePlayerResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/players/me`, method: 'GET', headers: {} });
    return await response.json();
  }

  async getPlayer(orgId: string, leagueId: string, playerId: string): Promise<LeaguePlayerResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/players/${playerId}`, method: 'GET', headers: {} });
    return await response.json();
  }
}

// Seasons API
export class V3SeasonsApi extends runtime.BaseAPI {
  async createSeason(orgId: string, leagueId: string, request: CreateSeasonRequest): Promise<SeasonResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/seasons`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async listSeasons(orgId: string, leagueId: string): Promise<SeasonResponse[]> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/seasons`, method: 'GET', headers: {} });
    return await response.json();
  }

  async getCurrentSeason(orgId: string, leagueId: string): Promise<SeasonResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/seasons/current`, method: 'GET', headers: {} });
    return await response.json();
  }
}

// Matches API
export class V3MatchesApi extends runtime.BaseAPI {
  async submitMatch(orgId: string, leagueId: string, request: SubmitMatchRequest): Promise<MatchResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/matches`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async getMatches(orgId: string, leagueId: string, params?: { seasonId?: string; limit?: number; offset?: number }): Promise<MatchResponse[]> {
    const query: runtime.HTTPQuery = {};
    if (params?.seasonId) query['seasonId'] = params.seasonId;
    if (params?.limit !== undefined) query['limit'] = params.limit;
    if (params?.offset !== undefined) query['offset'] = params.offset;
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/matches`, method: 'GET', headers: {}, query });
    return await response.json();
  }

  async getMatch(orgId: string, leagueId: string, matchId: string): Promise<MatchResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/matches/${matchId}`, method: 'GET', headers: {} });
    return await response.json();
  }

  async deleteMatch(orgId: string, leagueId: string, matchId: string): Promise<void> {
    await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/matches/${matchId}`, method: 'DELETE', headers: {} });
  }
}

// Leaderboard API
export class V3LeaderboardApi extends runtime.BaseAPI {
  async getLeaderboard(orgId: string, leagueId: string, seasonId?: string): Promise<LeaderboardResponse> {
    const query: runtime.HTTPQuery = {};
    if (seasonId) query['seasonId'] = seasonId;
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/leaderboard`, method: 'GET', headers: {}, query });
    return await response.json();
  }
}

// Rating History API
export class V3RatingHistoryApi extends runtime.BaseAPI {
  async getPlayerHistory(orgId: string, leagueId: string, leaguePlayerId: string, seasonId?: string): Promise<RatingHistoryResponse> {
    const query: runtime.HTTPQuery = {};
    if (seasonId) query['seasonId'] = seasonId;
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/rating-history/${leaguePlayerId}`, method: 'GET', headers: {}, query });
    return await response.json();
  }
}

// Queue API
export class V3QueueApi extends runtime.BaseAPI {
  async joinQueue(orgId: string, leagueId: string): Promise<void> {
    await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/queue`, method: 'POST', headers: {} });
  }

  async leaveQueue(orgId: string, leagueId: string): Promise<void> {
    await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/queue`, method: 'DELETE', headers: {} });
  }

  async getQueueStatus(orgId: string, leagueId: string): Promise<QueueStatusResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/queue`, method: 'GET', headers: {} });
    return await response.json();
  }
}

// Pending Matches API
export class V3PendingMatchesApi extends runtime.BaseAPI {
  async getPendingMatchStatus(orgId: string, leagueId: string, pendingMatchId: string): Promise<PendingMatchResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/pending-matches/${pendingMatchId}`, method: 'GET', headers: {} });
    return await response.json();
  }

  async acceptPendingMatch(orgId: string, leagueId: string, pendingMatchId: string): Promise<void> {
    await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/pending-matches/${pendingMatchId}/accept`, method: 'POST', headers: {} });
  }

  async declinePendingMatch(orgId: string, leagueId: string, pendingMatchId: string): Promise<void> {
    await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/pending-matches/${pendingMatchId}/decline`, method: 'POST', headers: {} });
  }
}

// Active Matches API
export class V3ActiveMatchesApi extends runtime.BaseAPI {
  async listActiveMatches(orgId: string, leagueId: string): Promise<ActiveMatchResponse[]> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/active-matches`, method: 'GET', headers: {} });
    return await response.json();
  }

  async cancelActiveMatch(orgId: string, leagueId: string, activeMatchId: string): Promise<void> {
    await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/active-matches/${activeMatchId}`, method: 'DELETE', headers: {} });
  }

  async submitResult(orgId: string, leagueId: string, activeMatchId: string, request: SubmitActiveMatchResultRequest): Promise<MatchResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/active-matches/${activeMatchId}/submit`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }
}

// Match Flags API
export class V3MatchFlagsApi extends runtime.BaseAPI {
  async createFlag(orgId: string, leagueId: string, request: CreateMatchFlagRequest): Promise<MatchFlagResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/match-flags`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async listFlags(orgId: string, leagueId: string, status?: MatchFlagStatus): Promise<MatchFlagResponse[]> {
    const query: runtime.HTTPQuery = {};
    if (status) query['status'] = status;
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/match-flags`, method: 'GET', headers: {}, query });
    return await response.json();
  }

  async getMyFlags(orgId: string, leagueId: string): Promise<MatchFlagResponse[]> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/match-flags/me`, method: 'GET', headers: {} });
    return await response.json();
  }

  async updateFlagReason(orgId: string, leagueId: string, flagId: string, request: UpdateMatchFlagReasonRequest): Promise<MatchFlagResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/match-flags/${flagId}`, method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async deleteFlag(orgId: string, leagueId: string, flagId: string): Promise<void> {
    await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/match-flags/${flagId}`, method: 'DELETE', headers: {} });
  }
}

// Admin Match Flags API
export class V3AdminMatchFlagsApi extends runtime.BaseAPI {
  async listAllFlags(orgId: string, leagueId: string, status?: MatchFlagStatus): Promise<MatchFlagResponse[]> {
    const query: runtime.HTTPQuery = {};
    if (status) query['status'] = status;
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/admin/match-flags`, method: 'GET', headers: {}, query });
    return await response.json();
  }

  async getFlag(orgId: string, leagueId: string, flagId: string): Promise<MatchFlagResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/admin/match-flags/${flagId}`, method: 'GET', headers: {} });
    return await response.json();
  }

  async resolveFlag(orgId: string, leagueId: string, flagId: string, request: ResolveMatchFlagRequest): Promise<MatchFlagResponse> {
    const response = await this.request({ path: `/api/v3/organizations/${orgId}/leagues/${leagueId}/admin/match-flags/${flagId}/resolve`, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }
}

// PAT API
export class V3PersonalAccessTokensApi extends runtime.BaseAPI {
  async generateToken(request: CreateTokenRequest): Promise<CreateTokenResponse> {
    const response = await this.request({ path: '/api/v3/me/tokens', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request });
    return await response.json();
  }

  async listTokens(): Promise<TokenResponse[]> {
    const response = await this.request({ path: '/api/v3/me/tokens', method: 'GET', headers: {} });
    return await response.json();
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.request({ path: `/api/v3/me/tokens/${tokenId}`, method: 'DELETE', headers: {} });
  }
}
