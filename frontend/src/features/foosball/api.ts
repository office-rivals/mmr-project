import { BaseAPI } from '@/api-v3/runtime';
import type { MatchResponse, SubmitMatchPlayerRequest } from '@/api-v3';

// Foosball hardware (goal counters + scoreboards) app API, under
// /api/v3/organizations/{orgId}/... — contract: api/docs/hardware-api.md.
// Hand-maintained like the rest of the v3 client.

export type TableEnd = 'A' | 'B';

export type SoundVolume = 0 | 1 | 2 | 3;

export const SOUND_VOLUMES = ['Off', 'Low', 'Medium', 'High'] as const;
export type DeviceRole = 'Goal' | 'Scoreboard';
export type TableMatchStatus = 'Live' | 'Finished' | 'Discarded' | 'Submitted';

export interface TableResponse {
  id: string;
  name: string;
  /** The league the table, its devices and its games belong to. */
  leagueId: string;
  endLabelA: string;
  endLabelB: string;
  /** End shown on the scoreboard's left half; the app mirrors that order. */
  scoreboardLeftEnd: TableEnd | null;
  /** Table sound (scoreboard and goal counters): 0 off, 1 low, 2 medium, 3 high. */
  soundVolume: SoundVolume;
  /** For the table's short link `/t/<shortCode>` (NFC sticker). */
  shortCode: string;
  createdAt: string;
  occupancy: TableOccupancy;
  /** A claimed scoreboard is assigned to the table. */
  hasScoreboard: boolean;
}

/** Whether someone is at the table right now, from goals, scans and wakes. */
export interface TableOccupancy {
  /**
   * analytics/METRICS.md §8.2. Unknown: no assigned goal counter, or every
   * device is out (dead battery, offline); never to be shown as free.
   * JustFinished lasts 3 min after the last goal.
   */
  status: 'Unknown' | 'InUse' | 'JustFinished' | 'ProbablyInUse' | 'Free';
  /**
   * InUse / ProbablyInUse: start of the activity; JustFinished: game end;
   * Free: the last goal ever, or null; Unknown: null.
   */
  since: string | null;
  /**
   * Touched: free, but someone's nearby (a bump). NoDevices / LowBattery /
   * Offline: why the status is Unknown.
   */
  reason:
    | 'Game'
    | 'Gathering'
    | 'TeamsMade'
    | 'LongPause'
    | 'DevicesAwake'
    | 'Touched'
    | 'NoDevices'
    | 'LowBattery'
    | 'Offline'
    | null;
  /** A game with a goal (InUse/ProbablyInUse), or the one just finished. */
  scoreA?: number | null;
  scoreB?: number | null;
  /** While gathering: "Gathering: 2 of 4". */
  rosterCount?: number | null;
  rosterSize?: number | null;
}

export interface ShortLinkResponse {
  kind: 'Table' | 'Card';
  /**
   * Table, by game state: `/<org>/<league>/tables/<id>` (live), `…/submit?table=<id>[&match=<id>]`
   * (to claim) or `…/match/<matchId>` (rated).
   * Card: `/<org>/cards?code=<code>`.
   */
  path: string;
  organizationId: string;
  orgSlug: string;
  tableId: string;
  tableName: string;
  /** Set when the path opens a claimable match. */
  tableMatchId: string | null;
  /** Set when the path opens a rated match's page. */
  matchId?: string | null;
  /** Card only: the code works until then (10 minutes after the scan). */
  cardLinkExpiresAt?: string | null;
}

/** A badge (NFC card) linked to a member. Only a keyed hash is stored. */
export interface PlayerCardResponse {
  id: string;
  createdAt: string;
  /** Set only when someone other than the owner linked it. */
  linkedBy?: {
    membershipId: string;
    displayName?: string | null;
    username?: string | null;
  } | null;
  /** POST only: linking also joins the scanning table's roster. */
  rosterResult?: RosterResult | null;
}

export type RosterResult =
  'Joined' | 'AlreadyIn' | 'RosterFull' | 'Locked' | 'Busy' | 'NoLeague';

export interface AdminPlayerCardResponse extends PlayerCardResponse {
  membershipId: string;
  displayName?: string | null;
  username?: string | null;
}

export interface UpsertTableRequest {
  name: string;
  leagueId: string;
  endLabelA?: string;
  endLabelB?: string;
  soundVolume?: SoundVolume;
}

export interface DeviceResponse {
  id: string;
  /** `fb-<12 hex>`, exactly as an unclaimed scoreboard prints it. */
  deviceId: string;
  claimed: boolean;
  role?: DeviceRole | null;
  tableId?: string | null;
  /** Goal counter: the goal it watches. Scoreboard: the end it sits on. */
  end?: TableEnd | null;
  lastSeenAt?: string | null;
  batteryMv?: number | null;
  lowBatt: boolean;
  firmwareVersion?: string | null;
  lastStatusAt?: string | null;
  /** The last status body as the device sent it (snake_case, openapi). */
  lastStatus?: {
    /** sleep | heartbeat | cutoff | wrong_board | beam (openapi). */
    reason?: string;
    beam?: BeamStatus | null;
  } | null;
  /** Goal counter; null: all firmware defaults. */
  beamConfig?: BeamConfig | null;
}

/**
 * A goal counter's beam config (firmware beam-health §6); a field left out
 * means the firmware default. Ranges are checked by the server (400).
 */
export interface BeamConfig {
  mode?: 'A' | 'ABoost' | 'B' | 'Auto';
  checkS?: number;
  settleMs?: number;
  ambientMaxPct?: number;
  marginMin?: number;
  driftPct?: number;
  deadDeltaUa?: number;
  deadChecks?: number;
  baselineMin?: number;
  reportS?: number;
  ambientSwitchUa?: number;
  ambientReturnUa?: number;
  modeMinDwellS?: number;
  rPuAOhm?: number;
  rPuBOhm?: number;
  /** [D9 LED, D10 boost] mA. */
  ledMa?: [number, number];
}

export type BeamHealth =
  'ok' | 'low_margin' | 'ambient_high' | 'blocked' | 'sensor_dead';
export type BeamMode = 'a' | 'a_boost' | 'b' | 'auto';

/** Goal counter beam health, `beam` in the firmware status (µA readings). */
export interface BeamStatus {
  health: BeamHealth;
  /** The active mode; `auto` itself is config only. */
  mode: BeamMode;
  amb_ua: number;
  lit1_ua: number;
  /** Lit margin, ×. */
  margin: number;
  /** Max since the last report. */
  ball_ua?: number | null;
  baseline_amb_ua?: number | null;
  baseline_lit1_ua?: number | null;
  /** Seconds between the check and the status. */
  checked_s: number;
}

export interface AssignDeviceRequest {
  role: DeviceRole;
  tableId: string;
  end: TableEnd;
}

export interface OrphanGoalResponse {
  id: string;
  eventId: string;
  deviceId: string;
  tableId?: string | null;
  /** The team it would have counted for. */
  end?: TableEnd | null;
  occurredAt?: string | null;
  receivedAt: string;
  reason: 'UnassignedDevice' | 'OtherTable' | 'NoMatch';
}

export interface EnrolmentTokenStatus {
  exists: boolean;
  createdAt?: string | null;
}

export interface TablePlayerResponse {
  leaguePlayerId: string;
  displayName?: string;
  username?: string;
  /** Scanned-in players: palette index 0–5 and its colour, as on the LEDs. */
  color?: number | null;
  colorHex?: string | null;
}

/** The scoreboard's scan-in line-up; present only while no game is on. */
export interface TableRosterResponse {
  leagueId: string;
  teamSize: number;
  /** In join order. */
  players: TablePlayerResponse[];
  /** Full: the scoreboard can generate teams. */
  canGenerate: boolean;
}

export interface TableMatchResponse {
  id: string;
  tableId: string;
  status: TableMatchStatus;
  startedAt: string;
  endedAt?: string | null;
  scoreA: number;
  scoreB: number;
  activeMatchId?: string | null;
  leagueId?: string | null;
  /** Empty unless linked to a matchmade match. */
  playersA: TablePlayerResponse[];
  playersB: TablePlayerResponse[];
  claimableUntil?: string | null;
  /** The rated match, once submitted. */
  matchId?: string | null;
  /** Finished linked match: rated automatically at this time. */
  autoSubmitAt?: string | null;
  lastGoal?: TableLastGoal | null;
}

export interface TableLastGoal {
  id: string;
  /** The team credited. */
  end: TableEnd;
  scorerLeaguePlayerId?: string | null;
  occurredAt: string;
}

/** A claimed table device as the players see it (`TableDeviceResponse`). */
export interface LiveDevice {
  end?: TableEnd | null;
  role: DeviceRole;
  lowBatt: boolean;
  beamHealth?: BeamHealth | null;
  lastSeenAt?: string | null;
}

export interface PreviousTableMatchResponse {
  id: string;
  matchId: string;
  leagueId: string;
  playersA: TablePlayerResponse[];
  playersB: TablePlayerResponse[];
}

export interface LiveTableResponse {
  table: TableResponse;
  version: number;
  match: TableMatchResponse | null;
  /** Last submitted match, for "Same players as last game". */
  previousMatch: PreviousTableMatchResponse | null;
  /** Null while a game is on, or when the table can't scan badges. */
  roster: TableRosterResponse | null;
  devices: LiveDevice[];
}

/** A counted goal of a rated table match (undone goals are left out). */
export interface MatchGoalResponse {
  id: string;
  /** The team credited (MatchTeam.Index); an own goal doesn't change it. */
  teamIndex: number;
  /** Event time, ordered ascending. */
  at: string;
  /** Running score after this goal; A = team index 0. */
  scoreA: number;
  scoreB: number;
  scorerLeaguePlayerId?: string | null;
  /** The scorer plays for the team that conceded. */
  ownGoal: boolean;
}

export interface MatchGoalsResponse {
  tableMatchId: string;
  matchId?: string | null;
  tableName: string;
  /** The caller played in the match, or is a moderator/owner. */
  canEdit: boolean;
  goals: MatchGoalResponse[];
}

export interface ClaimTableMatchRequest {
  teams: { end: TableEnd; players: SubmitMatchPlayerRequest[] }[];
}

const json = { 'Content-Type': 'application/json' };
const org = (orgId: string) => `/api/v3/organizations/${orgId}`;

/**
 * One stats number (analytics/METRICS.md §8.4). value is sent even when
 * enough is false, and is null only when nothing was measured. Fractions are
 * 0..1, durations seconds; low/high is a range (quartiles, or a 95% interval).
 */
export interface StatValue {
  value: number | null;
  n: number;
  minN: number;
  enough: boolean;
  low?: number | null;
  high?: number | null;
}

export interface OfficeHours {
  /** 'mon'..'sun'. */
  days: string[];
  /** 'HH:mm', in the stats' time zone. */
  start: string;
  end: string;
}

export interface TableGameCounts {
  games: number;
  /** Claimed or linked, so rated. */
  submitted: number;
  unclaimed: number;
}

export interface TableStatsDevice {
  deviceId: string;
  role?: DeviceRole | null;
  end?: TableEnd | null;
  goals: number;
  undoRate: StatValue;
  fastGapRate: StatValue;
  lowBatt: boolean;
  out: boolean;
}

/** GET .../tables/{id}/stats: every number ready-made, bucketed in timeZone. */
export interface TableStatsResponse {
  tableId: string;
  from: string;
  to: string;
  timeZone: string;
  officeHours: OfficeHours;
  games: StatValue;
  /** Mean of the full weeks; n = full weeks. */
  averageGamesPerWeek: StatValue;
  /** Every local day from..to, zeros included. */
  gamesPerDay: (TableGameCounts & { date: string })[];
  weeks: (TableGameCounts & {
    weekStart: string;
    fullWeek: boolean;
    utilisation: number | null;
  })[];
  busyHours: {
    /** 7 × 24, Monday first, local hours. */
    values: number[][];
    /** Average busy minutes in that weekday-hour, 0..60. */
    unit: 'busy_minutes';
    n: number;
    minN: number;
    weeksOfData: number;
    enough: boolean;
  };
  /** Median; low/high = 25th/75th percentile. */
  matchDurationS: StatValue;
  utilisation: StatValue;
  /** Only goal-based busy time is known yet: show "≥ 23 %". */
  utilisationIsLowerBound: boolean;
  // Admin only (the page hides them from players).
  claimRate: StatValue;
  claimRateLinked: StatValue;
  claimRateUnlinked: StatValue;
  /** Share of goals for end A; low/high = 95% Wilson interval. */
  endBias: StatValue;
  dataQuality: {
    devices: TableStatsDevice[];
    orphansOtherTable: number;
    orphansNoMatch: number;
    fragmentsPerWeek: number;
    discardedPerWeek: number;
    scorerPickRate: StatValue;
  };
}

export class FoosballApi extends BaseAPI {
  private async call<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await this.request({
      path,
      method,
      headers: body === undefined ? {} : json,
      body,
    });
    return response.status === 204 ? (undefined as T) : await response.json();
  }

  // Players (any org member)
  listTables(orgId: string) {
    return this.call<TableResponse[]>('GET', `${org(orgId)}/tables`);
  }
  /**
   * With `since` (the version you have) it's a long-poll: held until the
   * version changes or `wait` seconds pass, the current state either way.
   */
  getLive(orgId: string, tableId: string, since?: number, wait?: number) {
    const query =
      since == null
        ? ''
        : `?${new URLSearchParams({ since: `${since}`, wait: `${wait ?? 25}` })}`;
    return this.call<LiveTableResponse>(
      'GET',
      `${org(orgId)}/tables/${tableId}/live${query}`
    );
  }
  /** Ends the live game: `save` finishes it (claimable), else discards it. */
  newGame(
    orgId: string,
    tableId: string,
    save: boolean,
    expectedVersion: number
  ) {
    return this.call<LiveTableResponse>(
      'POST',
      `${org(orgId)}/tables/${tableId}/new-game`,
      { save, expectedVersion }
    );
  }
  /** Defaults: the last 30 days, UTC. 400 for an unknown tz or a bad range. */
  getTableStats(
    orgId: string,
    tableId: string,
    range: { from: string; to: string; tz: string }
  ) {
    return this.call<TableStatsResponse>(
      'GET',
      `${org(orgId)}/tables/${tableId}/stats?${new URLSearchParams(range)}`
    );
  }
  /** Claimable matches (finished, unsubmitted, unlinked), newest first. */
  listClaimable(orgId: string, tableId?: string) {
    const query = tableId ? `?tableId=${encodeURIComponent(tableId)}` : '';
    return this.call<TableMatchResponse[]>(
      'GET',
      `${org(orgId)}/table-matches${query}`
    );
  }
  claimMatch(
    orgId: string,
    leagueId: string,
    tableMatchId: string,
    request: ClaimTableMatchRequest
  ) {
    return this.call<MatchResponse>(
      'POST',
      `${org(orgId)}/leagues/${leagueId}/table-matches/${tableMatchId}/claim`,
      request
    );
  }
  linkActiveMatch(
    orgId: string,
    leagueId: string,
    activeMatchId: string,
    tableId: string
  ) {
    return this.call<LiveTableResponse>(
      'POST',
      `${org(orgId)}/leagues/${leagueId}/active-matches/${activeMatchId}/link-table`,
      { tableId }
    );
  }

  /** 404 when the match wasn't played on a table. */
  listMatchGoals(orgId: string, leagueId: string, matchId: string) {
    return this.call<MatchGoalsResponse>(
      'GET',
      `${org(orgId)}/leagues/${leagueId}/matches/${matchId}/goals`
    );
  }
  /** Any player of the match, or null to clear; the score never changes. */
  setGoalScorer(
    orgId: string,
    leagueId: string,
    matchId: string,
    goalId: string,
    leaguePlayerId: string | null
  ) {
    return this.call<MatchGoalResponse>(
      'PUT',
      `${org(orgId)}/leagues/${leagueId}/matches/${matchId}/goals/${goalId}/scorer`,
      { leaguePlayerId }
    );
  }

  /** 404 for an unknown code or one from an org the caller isn't in. */
  resolveShortLink(code: string) {
    return this.call<ShortLinkResponse>(
      'GET',
      `/api/v3/short-links/${encodeURIComponent(code)}`
    );
  }

  // Badges (the caller's own)
  listMyCards(orgId: string) {
    return this.call<PlayerCardResponse[]>('GET', `${org(orgId)}/me/cards`);
  }
  /**
   * Links the badge to the caller, or to another active member
   * (`membershipId`). 404 unknown/used code, 410 expired (scan again), 409
   * someone else's.
   */
  linkCard(orgId: string, code: string, membershipId?: string) {
    return this.call<PlayerCardResponse>('POST', `${org(orgId)}/me/cards`, {
      code,
      ...(membershipId ? { membershipId } : {}),
    });
  }
  unlinkCard(orgId: string, cardId: string) {
    return this.call<void>('DELETE', `${org(orgId)}/me/cards/${cardId}`);
  }

  // Admin (Moderator/Owner)
  listCards(orgId: string) {
    return this.call<AdminPlayerCardResponse[]>(
      'GET',
      `${org(orgId)}/admin/cards`
    );
  }
  deleteCard(orgId: string, cardId: string) {
    return this.call<void>('DELETE', `${org(orgId)}/admin/cards/${cardId}`);
  }
  /** Owner only. */
  deleteAllCards(orgId: string) {
    return this.call<{ deleted: number }>(
      'DELETE',
      `${org(orgId)}/admin/cards`
    );
  }

  createTable(orgId: string, request: UpsertTableRequest) {
    return this.call<TableResponse>(
      'POST',
      `${org(orgId)}/admin/tables`,
      request
    );
  }
  updateTable(orgId: string, tableId: string, request: UpsertTableRequest) {
    return this.call<TableResponse>(
      'PUT',
      `${org(orgId)}/admin/tables/${tableId}`,
      request
    );
  }
  /**
   * New permanent short code, random or a custom one (`[a-z0-9-]`, 3–32,
   * 409 if taken); the old one stops resolving (404).
   */
  regenerateShortCode(orgId: string, tableId: string, code?: string) {
    return this.call<TableResponse>(
      'POST',
      `${org(orgId)}/admin/tables/${tableId}/short-code`,
      code ? { code } : undefined
    );
  }
  deleteTable(orgId: string, tableId: string) {
    return this.call<void>('DELETE', `${org(orgId)}/admin/tables/${tableId}`);
  }
  listDevices(orgId: string) {
    return this.call<DeviceResponse[]>('GET', `${org(orgId)}/admin/devices`);
  }
  /** Newest 200 accepted goals that fit no match (never dropped). */
  listOrphanGoals(orgId: string) {
    return this.call<OrphanGoalResponse[]>(
      'GET',
      `${org(orgId)}/admin/orphan-goals`
    );
  }
  /** Claims an unclaimed device, or re-assigns a claimed one. */
  assignDevice(orgId: string, deviceId: string, request: AssignDeviceRequest) {
    return this.call<DeviceResponse>(
      'PUT',
      `${org(orgId)}/admin/devices/${deviceId}`,
      request
    );
  }
  /** Replaces a goal counter's beam config; `{}` = firmware defaults. */
  setBeamConfig(orgId: string, deviceId: string, config: BeamConfig) {
    return this.call<DeviceResponse>(
      'PUT',
      `${org(orgId)}/admin/devices/${deviceId}/beam-config`,
      config
    );
  }
  resetDevice(orgId: string, deviceId: string) {
    return this.call<DeviceResponse>(
      'POST',
      `${org(orgId)}/admin/devices/${deviceId}/reset`
    );
  }

  // Owner
  getEnrolmentToken(orgId: string) {
    return this.call<EnrolmentTokenStatus>(
      'GET',
      `${org(orgId)}/admin/device-enrolment-token`
    );
  }
  /** Creates or replaces the token; the response is the only time it shows. */
  rotateEnrolmentToken(orgId: string) {
    return this.call<{ token: string; createdAt: string }>(
      'POST',
      `${org(orgId)}/admin/device-enrolment-token`
    );
  }
  revokeEnrolmentToken(orgId: string) {
    return this.call<void>(
      'DELETE',
      `${org(orgId)}/admin/device-enrolment-token`
    );
  }
}
