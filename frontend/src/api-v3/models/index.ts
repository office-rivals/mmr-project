/* tslint:disable */
/* eslint-disable */
// Placeholder types matching v3 DTOs - will be replaced by generated code

// Enums
export enum OrganizationRole {
  Owner = 'Owner',
  Moderator = 'Moderator',
  Member = 'Member',
}

export enum MembershipStatus {
  Invited = 'Invited',
  Active = 'Active',
}

export enum MatchSource {
  Manual = 'Manual',
  Matchmaking = 'Matchmaking',
}

export enum AcceptanceStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Declined = 'Declined',
  Expired = 'Expired',
}

export enum MatchFlagStatus {
  Open = 'Open',
  Resolved = 'Resolved',
  Dismissed = 'Dismissed',
}

// Session DTOs
export interface MeResponse {
  id: string;
  identityUserId: string;
  email: string;
  username?: string;
  displayName?: string;
  organizations: MeOrganizationResponse[];
}

export interface MeOrganizationResponse {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
  leagues: MeLeagueResponse[];
}

export interface MeLeagueResponse {
  id: string;
  name: string;
  slug: string;
  leaguePlayerId: string;
}

// Organization DTOs
export interface CreateOrganizationRequest {
  name: string;
  slug: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrganizationMemberResponse {
  id: string;
  userId?: string;
  email?: string;
  displayName?: string;
  username?: string;
  role: OrganizationRole;
  status: MembershipStatus;
  claimedAt?: string;
  createdAt: string;
}

export interface InviteMemberRequest {
  email: string;
  role: OrganizationRole;
}

export interface UpdateMemberRoleRequest {
  role: OrganizationRole;
}

// League DTOs
export interface CreateLeagueRequest {
  name: string;
  slug: string;
  queueSize?: number;
}

export interface UpdateLeagueRequest {
  name?: string;
  slug?: string;
  queueSize?: number;
}

export interface LeagueResponse {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  queueSize: number;
  createdAt: string;
}

// League Player DTOs
export interface LeaguePlayerResponse {
  id: string;
  organizationMembershipId: string;
  displayName?: string;
  username?: string;
  mmr: number;
  mu: number;
  sigma: number;
  createdAt: string;
}

export interface JoinLeagueRequest {}

// Season DTOs
export interface CreateSeasonRequest {
  startsAt: string;
}

export interface SeasonResponse {
  id: string;
  leagueId: string;
  startsAt: string;
  createdAt: string;
}

// Match DTOs
export interface SubmitMatchRequest {
  teams: SubmitMatchTeamRequest[];
}

export interface SubmitMatchTeamRequest {
  players: string[];
  score: number;
}

export interface MatchResponse {
  id: string;
  leagueId: string;
  seasonId: string;
  source: MatchSource;
  playedAt: string;
  recordedAt: string;
  teams: MatchTeamResponse[];
  createdAt: string;
}

export interface MatchTeamResponse {
  id: string;
  index: number;
  score: number;
  isWinner: boolean;
  players: MatchTeamPlayerResponse[];
}

export interface MatchTeamPlayerResponse {
  id: string;
  leaguePlayerId: string;
  displayName?: string;
  username?: string;
  index: number;
  ratingDelta?: number;
}

// Leaderboard DTOs
export interface LeaderboardResponse {
  entries: LeaderboardEntryResponse[];
}

export interface LeaderboardEntryResponse {
  leaguePlayerId: string;
  displayName?: string;
  username?: string;
  mmr: number;
  mu: number;
  sigma: number;
  rank: number;
}

// Rating History DTOs
export interface RatingHistoryResponse {
  entries: RatingHistoryEntryResponse[];
}

export interface RatingHistoryEntryResponse {
  matchId: string;
  mmr: number;
  mu: number;
  sigma: number;
  delta: number;
  recordedAt: string;
}

// Matchmaking DTOs
export interface QueueStatusResponse {
  queuedPlayers: QueuedPlayerResponse[];
  pendingMatch?: PendingMatchResponse;
  activeMatch?: ActiveMatchResponse;
}

export interface QueuedPlayerResponse {
  leaguePlayerId: string;
  displayName?: string;
  username?: string;
  joinedAt: string;
}

export interface PendingMatchResponse {
  id: string;
  status: AcceptanceStatus;
  expiresAt: string;
  teams: PendingMatchTeamResponse[];
  acceptances: PendingMatchAcceptanceResponse[];
}

export interface PendingMatchTeamResponse {
  index: number;
  players: PendingMatchTeamPlayerResponse[];
}

export interface PendingMatchTeamPlayerResponse {
  leaguePlayerId: string;
  displayName?: string;
  username?: string;
  index: number;
}

export interface PendingMatchAcceptanceResponse {
  leaguePlayerId: string;
  status: AcceptanceStatus;
  acceptedAt?: string;
}

export interface ActiveMatchResponse {
  id: string;
  pendingMatchId: string;
  startedAt: string;
  teams: PendingMatchTeamResponse[];
}

export interface SubmitActiveMatchResultRequest {
  teams: ActiveMatchTeamScoreRequest[];
}

export interface ActiveMatchTeamScoreRequest {
  teamIndex: number;
  score: number;
}

// Match Flag DTOs
export interface CreateMatchFlagRequest {
  matchId: string;
  reason: string;
}

export interface ResolveMatchFlagRequest {
  status: MatchFlagStatus;
  resolutionNote?: string;
}

export interface MatchFlagResponse {
  id: string;
  matchId: string;
  flaggedByMembershipId: string;
  flaggedByDisplayName?: string;
  reason: string;
  status: MatchFlagStatus;
  resolutionNote?: string;
  resolvedByMembershipId?: string;
  resolvedByDisplayName?: string;
  resolvedAt?: string;
  createdAt: string;
}

// PAT DTOs
export interface CreateTokenRequest {
  name: string;
  organizationId?: string;
  leagueId?: string;
  scope: string;
  expiresAt?: string;
}

export interface TokenResponse {
  id: string;
  name: string;
  scope: string;
  organizationId?: string;
  leagueId?: string;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface CreateTokenResponse {
  token: string;
  tokenDetails: TokenResponse;
}

// JSON conversion helpers (placeholder - will be generated)
export function MeResponseFromJSON(json: any): MeResponse { return json; }
export function OrganizationResponseFromJSON(json: any): OrganizationResponse { return json; }
export function OrganizationMemberResponseFromJSON(json: any): OrganizationMemberResponse { return json; }
export function LeagueResponseFromJSON(json: any): LeagueResponse { return json; }
export function LeaguePlayerResponseFromJSON(json: any): LeaguePlayerResponse { return json; }
export function SeasonResponseFromJSON(json: any): SeasonResponse { return json; }
export function MatchResponseFromJSON(json: any): MatchResponse { return json; }
export function LeaderboardResponseFromJSON(json: any): LeaderboardResponse { return json; }
export function RatingHistoryResponseFromJSON(json: any): RatingHistoryResponse { return json; }
export function QueueStatusResponseFromJSON(json: any): QueueStatusResponse { return json; }
export function PendingMatchResponseFromJSON(json: any): PendingMatchResponse { return json; }
export function ActiveMatchResponseFromJSON(json: any): ActiveMatchResponse { return json; }
export function MatchFlagResponseFromJSON(json: any): MatchFlagResponse { return json; }
export function TokenResponseFromJSON(json: any): TokenResponse { return json; }
export function CreateTokenResponseFromJSON(json: any): CreateTokenResponse { return json; }
